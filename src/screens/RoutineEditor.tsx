import {
  createRef,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '../components/BottomSheet';
import { IconBack, IconDown, IconGrip, IconMore, IconUp, IconX } from '../components/Icons';
import { PageHeader } from '../components/PageHeader';
import { useCatalog } from '../hooks/useCatalog';
import { exerciseName } from '../lib/exercises';
import { fmtDate } from '../lib/format';
import { canonicalWeight, displayWeight, weightLabel } from '../lib/units';
import { trackingOf, type Routine, type RoutineExercise, type TrackingType } from '../lib/types';
import {
  continueAccountAction,
  isAccountActionCurrent,
  type AccountActionResult,
  useStore,
} from '../state/useStore';

const ICON = { width: 44, height: 44 } as const;
const REST_OPTIONS = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];

type PendingRoutineRemoval =
  | { kind: 'exercise'; exerciseIndex: number; exercise: string }
  | { kind: 'warmup'; exerciseIndex: number; warmupIndex: number };

function NumField({
  label,
  displayLabel,
  value,
  step,
  fieldKey,
  onCommit,
}: {
  label: string;
  displayLabel?: string;
  value: number | null | undefined;
  step: number;
  fieldKey: string;
  onCommit: (n: number | null) => void;
}) {
  return (
    <label className="stack routine-num-field" style={{ gap: 3 }}>
      <span className="mono muted" style={{ fontSize: 'var(--text-xs)', letterSpacing: '0.06em' }}>
        {displayLabel ?? label}
      </span>
      <input
        key={fieldKey}
        className="mono"
        type="number"
        inputMode="decimal"
        step={step}
        min={0}
        aria-label={label}
        defaultValue={value ?? ''}
        style={{ padding: '6px', textAlign: 'center' }}
        onChange={(e) => onCommit(e.target.value === '' ? null : Number(e.target.value))}
      />
    </label>
  );
}

function RangeField({
  label,
  minLabel,
  maxLabel,
  min,
  max,
  fieldKey,
  onMinCommit,
  onMaxCommit,
}: {
  label: string;
  minLabel: string;
  maxLabel: string;
  min: number;
  max: number | null;
  fieldKey: string;
  onMinCommit: (value: number | null) => void;
  onMaxCommit: (value: number | null) => void;
}) {
  return (
    <div className="stack routine-range-field" style={{ gap: 3 }}>
      <span className="mono muted">{label}</span>
      <div className="routine-range-field__control">
        <input
          key={`${fieldKey}-min`}
          className="mono"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          aria-label={minLabel}
          defaultValue={min}
          onChange={(event) =>
            onMinCommit(event.target.value === '' ? null : Number(event.target.value))
          }
        />
        <span aria-hidden="true">–</span>
        <input
          key={`${fieldKey}-max`}
          className="mono"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          aria-label={maxLabel}
          defaultValue={max ?? ''}
          onChange={(event) =>
            onMaxCommit(event.target.value === '' ? null : Number(event.target.value))
          }
        />
      </div>
    </div>
  );
}

function RestField({
  label,
  displayLabel,
  value,
  fieldKey,
  onCommit,
}: {
  label: string;
  displayLabel?: string;
  value: number;
  fieldKey: string;
  onCommit: (value: number) => void;
}) {
  const options = REST_OPTIONS.includes(value)
    ? REST_OPTIONS
    : [...REST_OPTIONS, value].sort((left, right) => left - right);
  return (
    <label className="stack routine-rest-field" style={{ gap: 3 }}>
      <span className="mono muted">{displayLabel ?? label}</span>
      <select
        key={fieldKey}
        className="mono"
        aria-label={label}
        defaultValue={value}
        onChange={(event) => onCommit(Number(event.target.value))}
      >
        {options.map((seconds) => (
          <option key={seconds} value={seconds}>
            {seconds === 0 ? '—' : restSummary(seconds)}
          </option>
        ))}
      </select>
    </label>
  );
}

function display(value: number | undefined, unit: 'kg' | 'lb'): number | undefined {
  return value === undefined ? undefined : displayWeight(value, unit);
}

function restSummary(seconds: number): string {
  if (seconds < 60) return `${seconds}″`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}′ ${remainder}″` : `${minutes} min`;
}

function exerciseSummary(rx: RoutineExercise, unit: 'kg' | 'lb'): string {
  const tracking = trackingOf(rx.tracking);
  const range =
    rx.repMax == null || rx.repMax === rx.repMin ? `${rx.repMin}` : `${rx.repMin}–${rx.repMax}`;
  const target = tracking === 'duration' ? `${range} s` : range;
  const parts = [`${rx.sets} × ${target}`];
  if (tracking === 'weight_reps' && rx.startWeightKg != null) {
    parts.push(`${displayWeight(rx.startWeightKg, unit)} ${weightLabel(unit)}`);
  }
  if (rx.restSec > 0) parts.push(restSummary(rx.restSec));
  return parts.join(' · ');
}

function defaultWarmup(rx: RoutineExercise): NonNullable<RoutineExercise['warmupSets']>[number] {
  if (trackingOf(rx.tracking) === 'duration') return { durationSec: rx.repMin };
  if (trackingOf(rx.tracking) === 'reps') return { reps: rx.repMin };
  return { weightKg: rx.startWeightKg, reps: rx.repMin };
}

export function RoutineEditor({ id }: { id: string }) {
  const { t, i18n } = useTranslation();
  useCatalog();
  const storedRoutine = useStore((s) => s.routines.find((r) => r.id === id));
  const folders = useStore((s) => s.folders);
  const catalogReady = useStore((s) => s.catalogReady);
  const notes = useStore((s) => s.notes);
  const unit = useStore((s) => s.settings.unit ?? 'kg');
  const nav = useStore((s) => s.nav);
  const saveRoutine = useStore((s) => s.saveRoutine);
  const deleteRoutine = useStore((s) => s.deleteRoutine);
  const startWorkout = useStore((s) => s.startWorkout);
  const [rev, setRev] = useState(0);
  const [expandedIndex, setExpandedIndex] = useState(0);
  const [exerciseMenuIndex, setExerciseMenuIndex] = useState<number | null>(null);
  const [goalTypeIndex, setGoalTypeIndex] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [reorderAnnouncement, setReorderAnnouncement] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<PendingRoutineRemoval | null>(null);
  const draftRef = useRef<Routine | null>(null);
  const latestSaveRef = useRef<Promise<AccountActionResult> | null>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const cancelRemovalRef = useRef<HTMLButtonElement>(null);
  const addExerciseRef = useRef<HTMLButtonElement>(null);
  const addWarmupRefs = useRef<Array<RefObject<HTMLButtonElement | null>>>([]);
  const warmupSummaryRefs = useRef<Array<RefObject<HTMLElement | null>>>([]);
  const removalCommittedRef = useRef(false);
  const dragStartRef = useRef<{ index: number; x: number; y: number; moved: boolean } | null>(null);

  if (storedRoutine && draftRef.current?.id !== id)
    draftRef.current = structuredClone(storedRoutine);
  const routine = draftRef.current ?? storedRoutine;

  function commit(mutate: (draft: Routine) => void, structural = false): void {
    if (!draftRef.current) return;
    const draft = structuredClone(draftRef.current);
    mutate(draft);
    draftRef.current = draft;
    if (structural) setRev((v) => v + 1);
    const save = saveRoutine(draft);
    latestSaveRef.current = save;
  }

  async function startEditedWorkout(): Promise<void> {
    let save = latestSaveRef.current;
    while (save) {
      const result = await save;
      if (!isAccountActionCurrent(result)) return;
      if (save === latestSaveRef.current) break;
      save = latestSaveRef.current;
    }
    startWorkout(id);
  }

  function updateWarmup(
    exerciseIndex: number,
    warmupIndex: number,
    patch: NonNullable<RoutineExercise['warmupSets']>[number],
  ): void {
    commit((draft) => {
      const warmups = [...(draft.exercises[exerciseIndex].warmupSets ?? [])];
      warmups[warmupIndex] = { ...warmups[warmupIndex], ...patch };
      draft.exercises[exerciseIndex].warmupSets = warmups;
    });
  }

  function requestRemoval(removal: PendingRoutineRemoval): void {
    removalCommittedRef.current = false;
    setPendingRemoval(removal);
  }

  function moveExercise(from: number, to: number): void {
    if (!routine) return;
    if (from === to || to < 0 || to >= routine.exercises.length) return;
    const movedName = exerciseName(routine.exercises[from].exerciseId, i18n.language);
    commit((draft) => {
      const [moved] = draft.exercises.splice(from, 1);
      draft.exercises.splice(to, 0, moved);
    }, true);
    setExpandedIndex((current) => {
      if (current === from) return to;
      if (from < current && current <= to) return current - 1;
      if (to <= current && current < from) return current + 1;
      return current;
    });
    setReorderAnnouncement(t('editor.movedTo', { exercise: movedName, position: to + 1 }));
  }

  function exerciseAtPoint(x: number, y: number): number | null {
    const card = document
      .elementsFromPoint(x, y)
      .map((element) => element.closest<HTMLElement>('[data-exercise-index]'))
      .find(Boolean);
    if (!card) return null;
    const index = Number(card.dataset.exerciseIndex);
    return Number.isFinite(index) ? index : null;
  }

  function startDrag(event: PointerEvent<HTMLButtonElement>, index: number): void {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = { index, x: event.clientX, y: event.clientY, moved: false };
  }

  function continueDrag(event: PointerEvent<HTMLButtonElement>): void {
    const start = dragStartRef.current;
    if (!start) return;
    if (!start.moved && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 8) return;
    start.moved = true;
    setDraggingIndex(start.index);
    const target = exerciseAtPoint(event.clientX, event.clientY);
    if (target !== null) setDragOverIndex(target);
    if (event.clientY < 88) window.scrollBy({ top: -14 });
    else if (event.clientY > window.innerHeight - 88) window.scrollBy({ top: 14 });
  }

  function finishDrag(event: PointerEvent<HTMLButtonElement>): void {
    const start = dragStartRef.current;
    dragStartRef.current = null;
    setDraggingIndex(null);
    setDragOverIndex(null);
    if (!start?.moved) return;
    const target = exerciseAtPoint(event.clientX, event.clientY) ?? dragOverIndex;
    if (target !== null) moveExercise(start.index, target);
  }

  function reorderWithKeyboard(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const target = event.key === 'ArrowUp' ? index - 1 : index + 1;
    moveExercise(index, target);
    requestAnimationFrame(() =>
      document.querySelector<HTMLButtonElement>(`[data-reorder-index="${target}"]`)?.focus(),
    );
  }

  function confirmRemoval(): void {
    if (!pendingRemoval || removalCommittedRef.current) return;
    removalCommittedRef.current = true;
    const removal = pendingRemoval;
    setPendingRemoval(null);
    if (removal.kind === 'exercise') {
      commit((draft) => void draft.exercises.splice(removal.exerciseIndex, 1), true);
      return;
    }
    commit(
      (draft) =>
        void draft.exercises[removal.exerciseIndex].warmupSets?.splice(removal.warmupIndex, 1),
      true,
    );
  }

  if (!storedRoutine || !routine)
    return (
      <div className="screen page">
        <PageHeader
          className="routine-editor-header"
          title={t('editor.title')}
          back={{ label: t('common.back'), icon: <IconBack />, onClick: () => history.back() }}
        />
        <div className="empty">{t('editor.notFound')}</div>
      </div>
    );

  return (
    <div className="screen page">
      <PageHeader
        className="routine-editor-header"
        title={
          <>
            <span className="visually-hidden">{t('editor.title')}: </span>
            <span>{routine.name}</span>
          </>
        }
        back={{ label: t('common.back'), icon: <IconBack />, onClick: () => history.back() }}
        action={
          <button
            className="btn btn-accent"
            disabled={routine.exercises.length === 0}
            onClick={() => void startEditedWorkout()}
          >
            {t('home.start')}
          </button>
        }
      />

      <label className="field" style={{ marginBottom: 'var(--space-3)' }}>
        <span
          className="mono meta muted"
          style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}
        >
          {t('editor.name')}
        </span>
        <input
          key={`name-${rev}`}
          defaultValue={routine.name}
          style={{ fontFamily: 'inherit', fontWeight: 600 }}
          onChange={(e) => commit((r) => void (r.name = e.target.value))}
        />
      </label>
      {folders.length > 0 && (
        <label className="field" style={{ marginBottom: 'var(--space-3)' }}>
          <span
            className="mono meta muted"
            style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}
          >
            {t('editor.folder')}
          </span>
          <select
            key={`folder-${rev}`}
            defaultValue={routine.folderId ?? ''}
            onChange={(e) => commit((r) => void (r.folderId = e.target.value || undefined))}
          >
            <option value="">{t('editor.noFolder')}</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="field" style={{ marginBottom: 'var(--space-4)' }}>
        <span
          className="mono meta muted"
          style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}
        >
          {t('editor.preparation')}
        </span>
        <textarea
          key={`warmup-${rev}`}
          defaultValue={routine.warmup ?? ''}
          aria-label={t('editor.preparation')}
          placeholder={t('editor.preparationPlaceholder')}
          rows={2}
          style={{ minHeight: 64, resize: 'vertical' }}
          onChange={(e) => commit((r) => void (r.warmup = e.target.value.trim() || undefined))}
        />
      </label>

      <div className="routine-exercise-list">
        {routine.exercises.map((rx, xi) => {
          const tracking = trackingOf(rx.tracking);
          const note = notes.find((item) => item.id === rx.exerciseId);
          const warmups = rx.warmupSets ?? [];
          const expanded = expandedIndex === xi;
          const name = exerciseName(rx.exerciseId, i18n.language);
          const minLabel = tracking === 'duration' ? t('editor.secondsMin') : t('editor.repMin');
          const maxLabel = tracking === 'duration' ? t('editor.secondsMax') : t('editor.repMax');
          const addWarmupRef =
            addWarmupRefs.current[xi] ??
            (addWarmupRefs.current[xi] = createRef<HTMLButtonElement>());
          const warmupSummaryRef =
            warmupSummaryRefs.current[xi] ??
            (warmupSummaryRefs.current[xi] = createRef<HTMLElement>());
          return (
            <section
              key={`${rx.exerciseId}-${xi}`}
              className={`routine-exercise${expanded ? ' is-expanded' : ''}${draggingIndex === xi ? ' is-dragging' : ''}${dragOverIndex === xi ? ' is-drop-target' : ''}`}
              data-exercise-index={xi}
            >
              <div className="routine-exercise__top">
                <button
                  className="routine-exercise__drag"
                  data-reorder-index={xi}
                  aria-label={t('editor.reorderExercise', { exercise: name })}
                  title={t('editor.reorderHint')}
                  onPointerDown={(event) => startDrag(event, xi)}
                  onPointerMove={continueDrag}
                  onPointerUp={finishDrag}
                  onPointerCancel={finishDrag}
                  onKeyDown={(event) => reorderWithKeyboard(event, xi)}
                >
                  <IconGrip />
                </button>
                <button
                  className="routine-exercise__summary"
                  aria-expanded={expanded}
                  aria-controls={`routine-exercise-${xi}`}
                  onClick={() => setExpandedIndex(expanded ? -1 : xi)}
                >
                  <span className={`routine-exercise__name${catalogReady ? '' : ' muted'}`}>
                    {name}
                  </span>
                  <span className="routine-exercise__prescription">
                    {exerciseSummary(rx, unit)}
                  </span>
                </button>
                <button
                  className="iconbtn routine-exercise__menu"
                  style={ICON}
                  aria-label={t('editor.exerciseOptions')}
                  onClick={() => setExerciseMenuIndex(xi)}
                >
                  <IconMore />
                </button>
              </div>

              {expanded && (
                <div id={`routine-exercise-${xi}`} className="routine-exercise__body">
                  <div className="routine-prescription-primary">
                    <NumField
                      label={t('editor.workingSets')}
                      displayLabel={t('editor.setsShort')}
                      value={rx.sets}
                      step={1}
                      fieldKey={`sets-${xi}-${rev}`}
                      onCommit={(n) =>
                        commit((r) => {
                          r.exercises[xi].sets = n ?? 1;
                          delete r.exercises[xi].setTargets;
                        })
                      }
                    />
                    <RangeField
                      label={tracking === 'duration' ? t('editor.seconds') : t('editor.reps')}
                      minLabel={minLabel}
                      maxLabel={maxLabel}
                      min={rx.repMin}
                      max={rx.repMax}
                      fieldKey={`range-${xi}-${rev}`}
                      onMinCommit={(n) =>
                        commit((r) => {
                          r.exercises[xi].repMin = n ?? 1;
                          delete r.exercises[xi].setTargets;
                        })
                      }
                      onMaxCommit={(n) =>
                        commit((r) => {
                          r.exercises[xi].repMax = n;
                          delete r.exercises[xi].setTargets;
                        })
                      }
                    />
                    <RestField
                      label={t('editor.restSeconds')}
                      displayLabel={t('editor.restShort')}
                      value={rx.restSec}
                      fieldKey={`rest-${xi}-${rev}`}
                      onCommit={(n) => commit((r) => void (r.exercises[xi].restSec = n))}
                    />
                  </div>

                  {tracking === 'weight_reps' && (
                    <details className="routine-disclosure routine-progression">
                      <summary>
                        <span>{t('editor.progressionSettings')}</span>
                        <span className="routine-disclosure__meta">
                          {rx.startWeightKg == null
                            ? '—'
                            : `${displayWeight(rx.startWeightKg, unit)} ${weightLabel(unit)}`}
                          {' · '}
                          {rx.incrementKg == null
                            ? '—'
                            : `+${displayWeight(rx.incrementKg, unit)} ${weightLabel(unit)}`}
                        </span>
                      </summary>
                      <div className="routine-disclosure__body routine-progression__body">
                        <NumField
                          label={t('editor.startWeight', { unit: weightLabel(unit) })}
                          value={display(rx.startWeightKg, unit)}
                          step={0.5}
                          fieldKey={`start-${xi}-${rev}`}
                          onCommit={(n) =>
                            commit((r) => {
                              r.exercises[xi].startWeightKg =
                                n === null ? undefined : canonicalWeight(n, unit);
                              delete r.exercises[xi].setTargets;
                            })
                          }
                        />
                        <NumField
                          label={t('editor.progression', { unit: weightLabel(unit) })}
                          value={display(rx.incrementKg, unit)}
                          step={0.5}
                          fieldKey={`increment-${xi}-${rev}`}
                          onCommit={(n) =>
                            commit(
                              (r) =>
                                void (r.exercises[xi].incrementKg =
                                  n === null ? undefined : canonicalWeight(n, unit)),
                            )
                          }
                        />
                      </div>
                    </details>
                  )}

                  <details className="routine-disclosure" open={warmups.length > 0}>
                    <summary ref={warmupSummaryRef}>
                      <span>{t('editor.warmupSets')}</span>
                      <span className="routine-disclosure__meta">{warmups.length}</span>
                    </summary>
                    <div className="routine-disclosure__body">
                      {warmups.map((target, wi) => (
                        <div key={`${wi}-${rev}`} className="routine-warmup-row">
                          <div className="routine-warmup-fields">
                            {tracking === 'weight_reps' && (
                              <NumField
                                label={t('editor.load', { unit: weightLabel(unit) })}
                                value={display(target.weightKg, unit)}
                                step={0.5}
                                fieldKey={`warmup-weight-${xi}-${wi}-${rev}`}
                                onCommit={(n) =>
                                  updateWarmup(xi, wi, {
                                    weightKg: n === null ? undefined : canonicalWeight(n, unit),
                                  })
                                }
                              />
                            )}
                            {tracking !== 'duration' ? (
                              <NumField
                                label={t('editor.reps')}
                                value={target.reps}
                                step={1}
                                fieldKey={`warmup-reps-${xi}-${wi}-${rev}`}
                                onCommit={(n) => updateWarmup(xi, wi, { reps: n ?? undefined })}
                              />
                            ) : (
                              <NumField
                                label={t('editor.seconds')}
                                value={target.durationSec}
                                step={1}
                                fieldKey={`warmup-seconds-${xi}-${wi}-${rev}`}
                                onCommit={(n) =>
                                  updateWarmup(xi, wi, { durationSec: n ?? undefined })
                                }
                              />
                            )}
                          </div>
                          <button
                            className="iconbtn"
                            style={ICON}
                            aria-label={t('editor.removeWarmupSet')}
                            onClick={() =>
                              requestRemoval({ kind: 'warmup', exerciseIndex: xi, warmupIndex: wi })
                            }
                          >
                            <IconX width={16} height={16} />
                          </button>
                        </div>
                      ))}
                      <button
                        ref={addWarmupRef}
                        className="btn btn-ghost btn-block"
                        onClick={() =>
                          commit((r) => {
                            r.exercises[xi].warmupSets = [
                              ...(r.exercises[xi].warmupSets ?? []),
                              defaultWarmup(r.exercises[xi]),
                            ];
                          }, true)
                        }
                      >
                        {t('editor.addWarmupSet')}
                      </button>
                    </div>
                  </details>

                  <details className="routine-disclosure" open={Boolean(rx.note)}>
                    <summary>
                      <span>{t('editor.techniqueNote')}</span>
                      {rx.note && (
                        <span className="routine-disclosure__meta">{t('editor.added')}</span>
                      )}
                    </summary>
                    <div className="routine-disclosure__body">
                      <textarea
                        key={`routine-note-${rx.exerciseId}-${xi}-${rev}`}
                        defaultValue={rx.note ?? ''}
                        aria-label={t('notes.coach')}
                        placeholder={t('notes.coachPlaceholder')}
                        rows={3}
                        onChange={(event) =>
                          commit((draft) => {
                            draft.exercises[xi].note = event.target.value.trim() || undefined;
                          })
                        }
                      />
                    </div>
                  </details>

                  {note?.entries.at(-1) && (
                    <button
                      className="routine-journal-link"
                      onClick={() => nav({ view: 'exercise', id: rx.exerciseId })}
                    >
                      <span>{t('editor.journalLatest')}</span>
                      <span>
                        {fmtDate(note.entries.at(-1)!.date, i18n.language)} ·{' '}
                        {note.entries.at(-1)?.text}
                      </span>
                    </button>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
      <span className="sr-only" aria-live="polite">
        {reorderAnnouncement}
      </span>
      {routine.exercises.length === 0 && <div className="empty">{t('editor.noExercises')}</div>}
      <button
        ref={addExerciseRef}
        className="btn btn-ghost btn-block"
        style={{ marginTop: 14 }}
        onClick={() => nav({ view: 'library', pickFor: { routineId: id } })}
      >
        {t('editor.addExercise')}
      </button>
      <button
        className="btn btn-danger btn-block"
        style={{ marginTop: 22 }}
        onClick={() => setConfirming(true)}
      >
        {t('editor.deleteRoutine')}
      </button>
      {exerciseMenuIndex !== null && routine.exercises[exerciseMenuIndex] && (
        <BottomSheet
          open
          title={t('editor.exerciseOptions')}
          onClose={() => setExerciseMenuIndex(null)}
        >
          <button
            className="routine-sheet-action"
            onClick={() => {
              setGoalTypeIndex(exerciseMenuIndex);
              setExerciseMenuIndex(null);
            }}
          >
            <span>{t('editor.goalType')}</span>
            <span className="muted small">
              {t(`editor.goal.${trackingOf(routine.exercises[exerciseMenuIndex].tracking)}.label`)}
            </span>
          </button>
          <button
            className="routine-sheet-action"
            disabled={exerciseMenuIndex === 0}
            onClick={() => {
              moveExercise(exerciseMenuIndex, exerciseMenuIndex - 1);
              setExerciseMenuIndex(null);
            }}
          >
            <span className="row" style={{ gap: 10 }}>
              <IconUp /> {t('editor.moveUp')}
            </span>
          </button>
          <button
            className="routine-sheet-action"
            disabled={exerciseMenuIndex === routine.exercises.length - 1}
            onClick={() => {
              moveExercise(exerciseMenuIndex, exerciseMenuIndex + 1);
              setExerciseMenuIndex(null);
            }}
          >
            <span className="row" style={{ gap: 10 }}>
              <IconDown /> {t('editor.moveDown')}
            </span>
          </button>
          <button
            className="routine-sheet-action is-danger"
            onClick={() => {
              const index = exerciseMenuIndex;
              const exercise = exerciseName(routine.exercises[index].exerciseId, i18n.language);
              setExerciseMenuIndex(null);
              requestRemoval({ kind: 'exercise', exerciseIndex: index, exercise });
            }}
          >
            <span>{t('editor.removeExercise')}</span>
          </button>
        </BottomSheet>
      )}
      {goalTypeIndex !== null && routine.exercises[goalTypeIndex] && (
        <BottomSheet open title={t('editor.goalType')} onClose={() => setGoalTypeIndex(null)}>
          <p className="muted small">{t('editor.goalTypeHint')}</p>
          {(['weight_reps', 'reps', 'duration'] as TrackingType[]).map((goal) => {
            const selected = trackingOf(routine.exercises[goalTypeIndex].tracking) === goal;
            return (
              <button
                key={goal}
                className={`routine-goal-option${selected ? ' is-selected' : ''}`}
                aria-pressed={selected}
                onClick={() => {
                  commit((draft) => void (draft.exercises[goalTypeIndex].tracking = goal), true);
                  setExpandedIndex(goalTypeIndex);
                  setGoalTypeIndex(null);
                }}
              >
                <span>{t(`editor.goal.${goal}.label`)}</span>
                <span>{t(`editor.goal.${goal}.hint`)}</span>
              </button>
            );
          })}
        </BottomSheet>
      )}
      {pendingRemoval && (
        <BottomSheet
          open
          title={
            pendingRemoval.kind === 'exercise'
              ? t('editor.removeExerciseTitle', { exercise: pendingRemoval.exercise })
              : t('editor.removeWarmupTitle')
          }
          initialFocusRef={cancelRemovalRef}
          fallbackFocusRef={
            pendingRemoval.kind === 'exercise'
              ? addExerciseRef
              : (routine.exercises[pendingRemoval.exerciseIndex].warmupSets?.length ?? 0) === 1
                ? warmupSummaryRefs.current[pendingRemoval.exerciseIndex]
                : addWarmupRefs.current[pendingRemoval.exerciseIndex]
          }
          onClose={() => setPendingRemoval(null)}
        >
          <span className="muted small">
            {t(
              pendingRemoval.kind === 'exercise'
                ? 'editor.removeExerciseBody'
                : 'editor.removeWarmupBody',
            )}
          </span>
          <button className="btn btn-danger btn-block" onClick={confirmRemoval}>
            {t('editor.removeConfirm')}
          </button>
          <button
            ref={cancelRemovalRef}
            className="btn btn-ghost btn-block"
            onClick={() => setPendingRemoval(null)}
          >
            {t('workout.cancel')}
          </button>
        </BottomSheet>
      )}
      {confirming && (
        <BottomSheet
          open
          title={t('editor.deleteRoutine')}
          initialFocusRef={cancelDeleteRef}
          onClose={() => setConfirming(false)}
        >
          <span className="muted small">{t('editor.deleteRoutineBody')}</span>
          <button
            className="btn btn-danger btn-block"
            onClick={() =>
              void continueAccountAction(deleteRoutine(id), () => nav({ view: 'train' }))
            }
          >
            {t('history.deleteConfirm')}
          </button>
          <button
            ref={cancelDeleteRef}
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
