import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { exerciseName, getCatalog } from '../lib/exercises';
import { lastTimeLine } from '../lib/format';
import { useStore } from '../state/useStore';
import { IconCheck, IconDown, IconMinus, IconNote, IconPlay } from '../components/Icons';
import { NoteEditor } from '../components/NoteEditor';

function fmtRest(sec: number): string {
  if (sec < 60) return `${sec}″`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}′${s}″` : `${m}′`;
}

export function Workout() {
  const { t, i18n } = useTranslation();
  const { active, routines, workouts, catalogReady } = useStore();
  const nav = useStore((s) => s.nav);
  const updateSet = useStore((s) => s.updateSet);
  const toggleDone = useStore((s) => s.toggleDone);
  const addSet = useStore((s) => s.addSet);
  const removeSet = useStore((s) => s.removeSet);
  const abandon = useStore((s) => s.abandonWorkout);
  const finish = useStore((s) => s.finishWorkout);
  const [confirming, setConfirming] = useState(false);
  const notes = useStore((s) => s.notes);
  const saveTechniqueNote = useStore((s) => s.saveTechniqueNote);
  const updateSessionNote = useStore((s) => s.updateSessionNote);
  const setRestOverride = useStore((st) => st.setRestOverride);
  const [editingRest, setEditingRest] = useState<number | null>(null);
  const [editingNote, setEditingNote] = useState<{
    exerciseIndex: number;
    scope: 'technique' | 'session';
  } | null>(null);
  const techniqueTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const queueTechnique = (exerciseId: string, text: string): void => {
    clearTimeout(techniqueTimers.current.get(exerciseId));
    techniqueTimers.current.set(
      exerciseId,
      setTimeout(() => void saveTechniqueNote(exerciseId, text), 500),
    );
  };
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const routine = routines.find((r) => r.id === active?.routineId);
  const broken = routines.length > 0 && (!active || !routine);
  useEffect(() => {
    // The routine (or its day) was deleted while this session was running:
    // clear the phantom session instead of bouncing between screens forever.
    if (broken) abandon();
  }, [broken, abandon]);
  if (!active || !routine) return null;

  const elapsed = Math.floor((Date.now() - active.startTs) / 1000);

  return (
    <div className="screen">
      <div
        className="row"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'var(--bg)',
          padding: '14px 0 8px',
        }}
      >
        <button className="iconbtn" aria-label={t('workout.minimize')} onClick={() => nav({ view: 'train' })}>
          <IconDown />
        </button>
        <div className="display" style={{ fontSize: 24, flex: 1 }}>
          {routine.name}
        </div>
        <span className="mono small muted">
          {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
        </span>
      </div>

      {routine.warmup && (
        <div className="banner banner-good" style={{ marginBottom: 10 }}>
          <b>{t('workout.warmup')}:</b> {routine.warmup}
        </div>
      )}

      <div className="stack">
        {active.ex.map((e, ei) => {
          // Resolve by id: the routine may have been edited mid-session.
          const rx = routine.exercises.find((x) => x.exerciseId === e.exerciseId);
          const last = lastTimeLine(workouts, e.exerciseId);
          const firstW = e.sets[0]?.weightKg ?? 0;
          const cat = catalogReady ? getCatalog().get(e.exerciseId) : undefined;
          return (
            <div key={ei} className="card">
              <div className="card-pad" style={{ paddingBottom: 8 }}>
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  <button
                    style={{ fontWeight: 700, fontSize: 16, textAlign: 'left' }}
                    onClick={() => nav({ view: 'exercise', id: e.exerciseId, from: 'workout' })}
                  >
                    {exerciseName(e.exerciseId, i18n.language)}
                  </button>
                  {cat?.youtubeId && (
                    <button
                      className="chip"
                      style={{ color: 'var(--accent-text)', fontWeight: 600 }}
                      onClick={() => nav({ view: 'exercise', id: e.exerciseId, from: 'workout' })}
                    >
                      <IconPlay width={11} height={11} style={{ verticalAlign: '-1px' }} aria-hidden /> {t('workout.video')}
                    </button>
                  )}
                </div>
                <div className="row" style={{ flexWrap: 'wrap', marginTop: 6, gap: 6 }}>
                  {rx && (
                    <>
                      <span className="chip">
                        {rx.sets}×{rx.repMin}
                        {rx.repMax ? `-${rx.repMax}` : '+'}
                      </span>
                      <button
                        className="chip"
                        aria-expanded={editingRest === ei}
                        onClick={() => setEditingRest(editingRest === ei ? null : ei)}
                      >
                        {t('workout.rest', { time: fmtRest(e.restOverride ?? rx.restSec) })} ▾
                      </button>
                    </>
                  )}
                  <span className="chip chip-accent">{t(e.hintKey, { kg: firstW })}</span>
                </div>
                {editingRest === ei && rx && (
                  <div className="row" style={{ marginTop: 8, gap: 8 }}>
                    <button
                      className="iconbtn"
                      style={{ width: 40, height: 40 }}
                      aria-label={t('workout.restLess')}
                      disabled={(e.restOverride ?? rx.restSec) <= 15}
                      onClick={() => setRestOverride(ei, Math.max(15, (e.restOverride ?? rx.restSec) - 15))}
                    >
                      <IconMinus width={14} height={14} />
                    </button>
                    <span className="mono" style={{ fontWeight: 700, minWidth: 56, textAlign: 'center' }}>
                      {fmtRest(e.restOverride ?? rx.restSec)}
                    </span>
                    <button
                      className="iconbtn"
                      style={{ width: 40, height: 40, fontWeight: 700 }}
                      aria-label={t('workout.restMore')}
                      onClick={() => setRestOverride(ei, (e.restOverride ?? rx.restSec) + 15)}
                    >
                      +
                    </button>
                    <button className="small" style={{ color: 'var(--accent-text)', fontWeight: 600, padding: 6 }} onClick={() => setEditingRest(null)}>
                      {t('momentum.done')}
                    </button>
                  </div>
                )}
                {rx?.note && <div className="small muted" style={{ marginTop: 6 }}>{rx.note}</div>}
                {last && (
                  <div className="mono small muted" style={{ marginTop: 6 }}>
                    {t('workout.lastTime', { date: last.date.slice(5), sets: last.sets })}
                  </div>
                )}
                {(() => {
                  const note = notes.find((n) => n.id === e.exerciseId);
                  const editingTechnique =
                    editingNote?.exerciseIndex === ei && editingNote.scope === 'technique';
                  const editingSession =
                    editingNote?.exerciseIndex === ei && editingNote.scope === 'session';
                  return (
                    <div className="stack" style={{ marginTop: 8, gap: 6 }}>
                      <div>
                        {editingTechnique ? (
                          <NoteEditor
                            key={`technique:${ei}`}
                            initial={note?.technique ?? ''}
                            placeholder={t('notes.techniquePlaceholder')}
                            ariaLabel={t('notes.technique')}
                            onChangeText={(text) => queueTechnique(e.exerciseId, text)}
                            onDone={() => setEditingNote(null)}
                          />
                        ) : (
                          <button
                            className="row small"
                            style={{
                              gap: 6,
                              alignItems: 'flex-start',
                              color: note?.technique ? 'var(--warn)' : 'var(--muted)',
                              minHeight: 32,
                              textAlign: 'left',
                              width: '100%',
                            }}
                            onClick={() => setEditingNote({ exerciseIndex: ei, scope: 'technique' })}
                          >
                            <IconNote width={14} height={14} aria-hidden style={{ flex: 'none', marginTop: 2 }} />
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <b>{t('notes.technique')}</b>
                              <span style={{ display: 'block', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                                {note?.technique || t('notes.techniquePlaceholder')}
                              </span>
                            </span>
                          </button>
                        )}
                      </div>
                      <div>
                        {editingSession ? (
                          <NoteEditor
                            key={`session:${ei}`}
                            initial={e.sessionNote ?? ''}
                            placeholder={t('notes.sessionPlaceholder')}
                            ariaLabel={t('notes.session')}
                            onChangeText={(text) => updateSessionNote(ei, text)}
                            onDone={() => setEditingNote(null)}
                          />
                        ) : (
                          <button
                            className="row small"
                            style={{
                              gap: 6,
                              alignItems: 'flex-start',
                              color: e.sessionNote ? 'var(--warn)' : 'var(--muted)',
                              minHeight: 32,
                              textAlign: 'left',
                              width: '100%',
                            }}
                            onClick={() => setEditingNote({ exerciseIndex: ei, scope: 'session' })}
                          >
                            <IconNote width={14} height={14} aria-hidden style={{ flex: 'none', marginTop: 2 }} />
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <b>{t('notes.session')}</b>
                              <span style={{ display: 'block', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                                {e.sessionNote || t('notes.sessionPlaceholder')}
                              </span>
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="setgrid setgrid-head mono small muted">
                <span>#</span>
                <span>{t('workout.kg')}</span>
                <span>{t('workout.reps')}</span>
                <span><IconCheck width={12} height={12} /></span>
              </div>
              {e.sets.map((s, si) => (
                <div key={si} className={`setgrid setrow${s.done ? ' done' : ''}`}>
                  <span className="mono small muted" style={{ textAlign: 'center' }}>
                    {si + 1}
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step={0.5}
                    min={0}
                    aria-label={t('workout.kg')}
                    value={s.weightKg ?? ''}
                    onChange={(ev) =>
                      updateSet(ei, si, { weightKg: ev.target.value === '' ? null : +ev.target.value })
                    }
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    step={1}
                    min={0}
                    aria-label={t('workout.reps')}
                    value={s.reps ?? ''}
                    onChange={(ev) =>
                      updateSet(ei, si, { reps: ev.target.value === '' ? null : +ev.target.value })
                    }
                  />
                  <button
                    className="setcheck"
                    aria-pressed={s.done}
                    aria-label={`${t('workout.set')} ${si + 1}`}
                    onClick={() => toggleDone(ei, si)}
                  >
                    <IconCheck />
                  </button>
                </div>
              ))}
              <div className="row" style={{ borderTop: '1px dashed var(--line)' }}>
                <button className="addset" onClick={() => addSet(ei)}>
                  {t('workout.addSet')}
                </button>
                {e.sets.length > 1 && (
                  <button className="addset" style={{ flex: 0, paddingInline: 16 }} onClick={() => removeSet(ei)} aria-label={t('workout.removeSet')}>
                    <IconMinus />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <button className="btn btn-accent btn-block btn-big" style={{ marginTop: 18 }} onClick={() => void finish()}>
        {t('workout.finish')}
      </button>
      <button
        className="btn btn-ghost btn-block"
        style={{ marginTop: 10, color: 'var(--danger)' }}
        onClick={() => {
          const anyDone = active.ex.some((x) => x.sets.some((st) => st.done));
          if (anyDone) setConfirming(true);
          else abandon();
        }}
      >
        {t('workout.abandonConfirm')}
      </button>

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
