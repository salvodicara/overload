import { createRef, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '../components/BottomSheet';
import { IconBack, IconDown, IconUp, IconX } from '../components/Icons';
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

type PendingRoutineRemoval =
  | { kind: 'exercise'; exerciseIndex: number; exercise: string }
  | { kind: 'warmup'; exerciseIndex: number; warmupIndex: number };

function NumField({
  label,
  value,
  step,
  fieldKey,
  onCommit,
}: {
  label: string;
  value: number | null | undefined;
  step: number;
  fieldKey: string;
  onCommit: (n: number | null) => void;
}) {
  return (
    <label className="stack" style={{ gap: 3 }}>
      <span className="mono muted" style={{ fontSize: 'var(--text-xs)', letterSpacing: '0.06em' }}>
        {label}
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
        style={{ minHeight: 48, padding: '8px', textAlign: 'center' }}
        onChange={(e) => onCommit(e.target.value === '' ? null : Number(e.target.value))}
      />
    </label>
  );
}

function display(value: number | undefined, unit: 'kg' | 'lb'): number | undefined {
  return value === undefined ? undefined : displayWeight(value, unit);
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
  const [confirming, setConfirming] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<PendingRoutineRemoval | null>(null);
  const draftRef = useRef<Routine | null>(null);
  const latestSaveRef = useRef<Promise<AccountActionResult> | null>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const cancelRemovalRef = useRef<HTMLButtonElement>(null);
  const addExerciseRef = useRef<HTMLButtonElement>(null);
  const addWarmupRefs = useRef<Array<RefObject<HTMLButtonElement | null>>>([]);
  const removalCommittedRef = useRef(false);

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
          title={t('editor.title')}
          back={{ label: t('common.back'), icon: <IconBack />, onClick: () => history.back() }}
        />
        <div className="empty">{t('editor.notFound')}</div>
      </div>
    );

  const grid = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 8,
  } as const;
  return (
    <div className="screen page">
      <PageHeader
        title={t('editor.title')}
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

      <div className="stack">
        {routine.exercises.map((rx, xi) => {
          const tracking = trackingOf(rx.tracking);
          const note = notes.find((item) => item.id === rx.exerciseId);
          const warmups = rx.warmupSets ?? [];
          const minLabel = tracking === 'duration' ? t('editor.timeMin') : t('editor.repMin');
          const maxLabel = tracking === 'duration' ? t('editor.timeMax') : t('editor.repMax');
          const addWarmupRef =
            addWarmupRefs.current[xi] ??
            (addWarmupRefs.current[xi] = createRef<HTMLButtonElement>());
          return (
            <div
              key={`${rx.exerciseId}-${xi}-${rev}`}
              className="card card-pad stack"
              style={{ gap: 10 }}
            >
              <div className="row">
                <span
                  style={{ flex: 1, minWidth: 0, fontWeight: 600 }}
                  className={catalogReady ? undefined : 'muted'}
                >
                  {exerciseName(rx.exerciseId, i18n.language)}
                </span>
                <button
                  className="iconbtn"
                  style={ICON}
                  aria-label={t('editor.moveUp')}
                  disabled={xi === 0}
                  onClick={() =>
                    commit((r) => {
                      [r.exercises[xi - 1], r.exercises[xi]] = [
                        r.exercises[xi],
                        r.exercises[xi - 1],
                      ];
                    }, true)
                  }
                >
                  <IconUp width={16} height={16} />
                </button>
                <button
                  className="iconbtn"
                  style={ICON}
                  aria-label={t('editor.moveDown')}
                  disabled={xi === routine.exercises.length - 1}
                  onClick={() =>
                    commit((r) => {
                      [r.exercises[xi], r.exercises[xi + 1]] = [
                        r.exercises[xi + 1],
                        r.exercises[xi],
                      ];
                    }, true)
                  }
                >
                  <IconDown width={16} height={16} />
                </button>
                <button
                  className="iconbtn"
                  style={ICON}
                  aria-label={t('editor.removeExercise')}
                  onClick={() =>
                    requestRemoval({
                      kind: 'exercise',
                      exerciseIndex: xi,
                      exercise: exerciseName(rx.exerciseId, i18n.language),
                    })
                  }
                >
                  <IconX width={16} height={16} />
                </button>
              </div>
              <details open className="stack" style={{ gap: 10 }}>
                <summary
                  style={{
                    minHeight: 44,
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {t('editor.settings')}
                </summary>
                <label className="stack" style={{ gap: 3 }}>
                  <span
                    className="mono muted"
                    style={{ fontSize: 'var(--text-xs)', letterSpacing: '0.06em' }}
                  >
                    {t('editor.tracking')}
                  </span>
                  <select
                    aria-label={t('editor.tracking')}
                    value={tracking}
                    style={{ minHeight: 48 }}
                    onChange={(e) =>
                      commit(
                        (r) => void (r.exercises[xi].tracking = e.target.value as TrackingType),
                        true,
                      )
                    }
                  >
                    <option value="weight_reps">{t('editor.trackingWeightReps')}</option>
                    <option value="reps">{t('editor.trackingReps')}</option>
                    <option value="duration">{t('editor.trackingDuration')}</option>
                  </select>
                </label>
                <div style={grid}>
                  <NumField
                    label={t('editor.workingSets')}
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
                  <NumField
                    label={t('editor.rest')}
                    value={rx.restSec}
                    step={5}
                    fieldKey={`rest-${xi}-${rev}`}
                    onCommit={(n) => commit((r) => void (r.exercises[xi].restSec = n ?? 60))}
                  />
                  <NumField
                    label={minLabel}
                    value={rx.repMin}
                    step={1}
                    fieldKey={`min-${xi}-${rev}`}
                    onCommit={(n) =>
                      commit((r) => {
                        r.exercises[xi].repMin = n ?? 1;
                        delete r.exercises[xi].setTargets;
                      })
                    }
                  />
                  <NumField
                    label={maxLabel}
                    value={rx.repMax}
                    step={1}
                    fieldKey={`max-${xi}-${rev}`}
                    onCommit={(n) =>
                      commit((r) => {
                        r.exercises[xi].repMax = n;
                        delete r.exercises[xi].setTargets;
                      })
                    }
                  />
                  {tracking === 'weight_reps' && (
                    <>
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
                        label={t('editor.increment', { unit: weightLabel(unit) })}
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
                    </>
                  )}
                </div>
                <div className="stack" style={{ gap: 8 }}>
                  <span
                    className="mono small muted"
                    style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}
                  >
                    {t('editor.warmupSets')}
                  </span>
                  {warmups.map((target, wi) => (
                    <div key={`${wi}-${rev}`} className="row" style={{ alignItems: 'end', gap: 8 }}>
                      <div style={{ ...grid, flex: 1 }}>
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
                        {tracking !== 'duration' && (
                          <NumField
                            label={t('editor.reps')}
                            value={target.reps}
                            step={1}
                            fieldKey={`warmup-reps-${xi}-${wi}-${rev}`}
                            onCommit={(n) => updateWarmup(xi, wi, { reps: n ?? undefined })}
                          />
                        )}
                        {tracking === 'duration' && (
                          <NumField
                            label={t('editor.seconds')}
                            value={target.durationSec}
                            step={1}
                            fieldKey={`warmup-seconds-${xi}-${wi}-${rev}`}
                            onCommit={(n) => updateWarmup(xi, wi, { durationSec: n ?? undefined })}
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
              <label className="stack" style={{ gap: 4 }}>
                <span
                  className="mono small muted"
                  style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}
                >
                  {t('notes.coach')}
                </span>
                <textarea
                  key={`routine-note-${rx.exerciseId}-${rev}`}
                  defaultValue={rx.note ?? ''}
                  aria-label={t('notes.coach')}
                  placeholder={t('notes.coachPlaceholder')}
                  rows={2}
                  style={{ minHeight: 64, resize: 'vertical' }}
                  onChange={(event) =>
                    commit((draft) => {
                      draft.exercises[xi].note = event.target.value.trim() || undefined;
                    })
                  }
                />
              </label>
              {note?.entries.at(-1) && (
                <button
                  className="mono small muted"
                  style={{ textAlign: 'left', padding: '2px 0', width: '100%', minHeight: 44 }}
                  onClick={() => nav({ view: 'exercise', id: rx.exerciseId })}
                >
                  {t('editor.journalLatest')} {fmtDate(note.entries.at(-1)!.date, i18n.language)} ·{' '}
                  {note.entries.at(-1)?.text}
                </button>
              )}
            </div>
          );
        })}
      </div>
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
