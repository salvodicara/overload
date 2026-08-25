import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconBack, IconDown, IconNote, IconUp, IconX } from '../components/Icons';
import { NoteEditor } from '../components/NoteEditor';
import { exerciseName } from '../lib/exercises';
import { useStore } from '../state/useStore';
import type { Routine } from '../lib/types';

const ICON = { width: 44, height: 44 } as const;

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
      <span
        className="mono muted"
        style={{
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          whiteSpace: 'nowrap',
          textAlign: 'center',
        }}
      >
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
        style={{ padding: '8px 4px', textAlign: 'center' }}
        onChange={(e) => onCommit(e.target.value === '' ? null : Number(e.target.value))}
      />
    </label>
  );
}

export function RoutineEditor({ id }: { id: string }) {
  const { t, i18n } = useTranslation();
  const routine = useStore((s) => s.routines.find((r) => r.id === id));
  const folders = useStore((s) => s.folders);
  const catalogReady = useStore((s) => s.catalogReady);
  const nav = useStore((s) => s.nav);
  const saveRoutine = useStore((s) => s.saveRoutine);
  const deleteRoutine = useStore((s) => s.deleteRoutine);
  const startWorkout = useStore((s) => s.startWorkout);
  const [rev, setRev] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [editingNote, setEditingNote] = useState<number | null>(null);
  const notes = useStore((s) => s.notes);

  /** Mutates the freshest copy, then persists (store stamps updatedAt + syncs). */
  function commit(mutate: (draft: Routine) => void, structural = false): void {
    const current = useStore.getState().routines.find((r) => r.id === id);
    if (!current) return;
    const draft = structuredClone(current);
    mutate(draft);
    void saveRoutine(draft).then(() => {
      if (structural) setRev((v) => v + 1);
    });
  }

  if (!routine) {
    return (
      <div className="screen">
        <div className="row" style={{ padding: '18px 0 6px' }}>
          <button className="iconbtn" aria-label={t('common.back')} onClick={() => nav({ view: 'train' })}>
            <IconBack />
          </button>
        </div>
        <div className="empty">{t('editor.notFound')}</div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="row" style={{ padding: '18px 0 10px' }}>
        <button className="iconbtn" aria-label={t('common.back')} onClick={() => nav({ view: 'train' })}>
          <IconBack />
        </button>
        <div className="display" style={{ fontSize: 24, flex: 1 }}>
          {t('editor.title')}
        </div>
        <button
          className="btn btn-accent"
          disabled={routine.exercises.length === 0}
          onClick={() => startWorkout(routine.id)}
        >
          {t('home.start')}
        </button>
      </div>

      <label className="stack" style={{ gap: 4, marginBottom: 10 }}>
        <span className="mono small muted" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
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
        <label className="stack" style={{ gap: 4, marginBottom: 14 }}>
          <span className="mono small muted" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {t('editor.folder')}
          </span>
          <select
            key={`folder-${rev}`}
            defaultValue={routine.folderId ?? ''}
            onChange={(e) =>
              commit((r) => void (r.folderId = e.target.value === '' ? undefined : e.target.value))
            }
          >
            <option value="">{t('editor.noFolder')}</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="stack">
        {routine.exercises.map((rx, xi) => (
          <div key={`${rx.exerciseId}-${xi}-${rev}`} className="card card-pad stack" style={{ gap: 10 }}>
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
                    [r.exercises[xi - 1], r.exercises[xi]] = [r.exercises[xi], r.exercises[xi - 1]];
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
                    [r.exercises[xi], r.exercises[xi + 1]] = [r.exercises[xi + 1], r.exercises[xi]];
                  }, true)
                }
              >
                <IconDown width={16} height={16} />
              </button>
              <button
                className="iconbtn"
                style={ICON}
                aria-label={t('editor.removeExercise')}
                onClick={() => commit((r) => void r.exercises.splice(xi, 1), true)}
              >
                <IconX width={16} height={16} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              <NumField label={t('editor.sets')} value={rx.sets} step={1} fieldKey={`s-${xi}-${rev}`} onCommit={(n) => commit((r) => void (r.exercises[xi].sets = n ?? 1))} />
              <NumField label={t('editor.repMin')} value={rx.repMin} step={1} fieldKey={`rmin-${xi}-${rev}`} onCommit={(n) => commit((r) => void (r.exercises[xi].repMin = n ?? 1))} />
              <NumField label={t('editor.repMax')} value={rx.repMax} step={1} fieldKey={`rmax-${xi}-${rev}`} onCommit={(n) => commit((r) => void (r.exercises[xi].repMax = n))} />
              <NumField label={t('editor.rest')} value={rx.restSec} step={5} fieldKey={`rest-${xi}-${rev}`} onCommit={(n) => commit((r) => void (r.exercises[xi].restSec = n ?? 60))} />
              <NumField label={t('editor.startWeight')} value={rx.startWeightKg} step={0.5} fieldKey={`sw-${xi}-${rev}`} onCommit={(n) => commit((r) => void (r.exercises[xi].startWeightKg = n ?? undefined))} />
            </div>
            {editingNote === xi ? (
              <NoteEditor
                key={`note-${xi}-${rev}`}
                initial={rx.note ?? ''}
                placeholder={t('editor.notePlaceholder')}
                ariaLabel={t('editor.noteLabel')}
                onChangeText={(text) => commit((r) => void (r.exercises[xi].note = text.trim() || undefined))}
                onDone={() => setEditingNote(null)}
              />
            ) : (
              <button
                className="row small"
                style={{
                  gap: 6,
                  alignItems: 'flex-start',
                  color: rx.note ? 'var(--warn)' : 'var(--muted)',
                  fontWeight: 600,
                  minHeight: 30,
                  textAlign: 'left',
                  width: '100%',
                }}
                onClick={() => setEditingNote(xi)}
              >
                <IconNote width={14} height={14} aria-hidden style={{ flex: 'none', marginTop: 2 }} />
                <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', flex: 1, minWidth: 0 }}>
                  {rx.note ?? t('editor.notePlaceholder')}
                </span>
              </button>
            )}
            {(() => {
              const journal = notes.find((n) => n.id === rx.exerciseId);
              const latest = journal?.entries[journal.entries.length - 1];
              if (!latest) return null;
              return (
                <button
                  className="mono small muted"
                  style={{ textAlign: 'left', padding: '2px 0', width: '100%' }}
                  onClick={() => nav({ view: 'exercise', id: rx.exerciseId })}
                >
                  {t('editor.journalLatest')} {latest.date} · {latest.text}
                </button>
              );
            })()}
          </div>
        ))}
      </div>

      {routine.exercises.length === 0 && <div className="empty">{t('editor.noExercises')}</div>}

      <button
        className="btn btn-ghost btn-block"
        style={{ marginTop: 14 }}
        onClick={() => nav({ view: 'library', pickFor: { routineId: id } })}
      >
        {t('editor.addExercise')}
      </button>

      <button className="btn btn-danger btn-block" style={{ marginTop: 22 }} onClick={() => setConfirming(true)}>
        {t('editor.deleteRoutine')}
      </button>

      {confirming && (
        <div className="sheet-scrim" role="dialog" aria-modal="true">
          <div className="sheet card card-pad stack">
            <strong>{t('editor.deleteRoutine')}</strong>
            <span className="muted small">{t('editor.deleteRoutineBody')}</span>
            <button
              className="btn btn-danger btn-block"
              onClick={() => {
                void deleteRoutine(id).then(() => nav({ view: 'train' }));
              }}
            >
              {t('history.deleteConfirm')}
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
