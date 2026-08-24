import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { exerciseName, getCatalog } from '../lib/exercises';
import { lastTimeLine } from '../lib/format';
import { useStore } from '../state/useStore';
import { IconCheck, IconMinus, IconPlay, IconX } from '../components/Icons';

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
  const phase = useStore((s) => s.phase)();
  const [confirming, setConfirming] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const routine = routines.find((r) => r.id === active?.routineId);
  const day = routine?.days[active?.dayIndex ?? -1];
  const broken = routines.length > 0 && (!active || !routine || !day);
  useEffect(() => {
    // The routine (or its day) was deleted while this session was running:
    // clear the phantom session instead of bouncing between screens forever.
    if (broken) abandon();
  }, [broken, abandon]);
  if (!active || !routine || !day) return null;

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
        <button
          className="iconbtn"
          aria-label={t('workout.abandonTitle')}
          onClick={() => {
            const anyDone = active.ex.some((e) => e.sets.some((s) => s.done));
            if (anyDone) setConfirming(true);
            else abandon();
          }}
        >
          <IconX />
        </button>
        <div className="display" style={{ fontSize: 24, flex: 1 }}>
          {day.label} · {day.name}
        </div>
        <span className="mono small muted">
          {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
        </span>
      </div>

      {phase?.key === 'reactivation' && (
        <div className="banner banner-warn" style={{ marginBottom: 10 }}>
          <b>{t('phase.reactivation')}:</b> {t('phase.hint.reactivation')}
        </div>
      )}
      {day.warmup && (
        <div className="banner banner-good" style={{ marginBottom: 10 }}>
          <b>{t('workout.warmup')}:</b> {day.warmup}
        </div>
      )}

      <div className="stack">
        {active.ex.map((e, ei) => {
          // Resolve by id: the routine may have been edited mid-session.
          const rx = day.exercises.find((x) => x.exerciseId === e.exerciseId);
          const last = lastTimeLine(workouts, e.exerciseId);
          const firstW = e.sets[0]?.weightKg ?? 0;
          const cat = catalogReady ? getCatalog().get(e.exerciseId) : undefined;
          return (
            <div key={ei} className="card">
              <div className="card-pad" style={{ paddingBottom: 8 }}>
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  <button
                    style={{ fontWeight: 700, fontSize: 16, textAlign: 'left' }}
                    onClick={() => nav({ view: 'exercise', id: e.exerciseId })}
                  >
                    {exerciseName(e.exerciseId, i18n.language)}
                  </button>
                  {cat?.youtubeId && (
                    <span className="chip" style={{ color: 'var(--accent-text)' }}>
                      <IconPlay width={11} height={11} style={{ verticalAlign: '-1px' }} /> {t('workout.video')}
                    </span>
                  )}
                </div>
                <div className="row" style={{ flexWrap: 'wrap', marginTop: 6, gap: 6 }}>
                  {rx && (
                    <>
                      <span className="chip">
                        {rx.sets}×{rx.repMin}
                        {rx.repMax ? `-${rx.repMax}` : '+'}
                      </span>
                      <span className="chip">{t('workout.rest', { time: fmtRest(rx.restSec) })}</span>
                    </>
                  )}
                  <span className="chip chip-accent">{t(e.hintKey, { kg: firstW })}</span>
                </div>
                {rx?.note && <div className="small muted" style={{ marginTop: 6 }}>{rx.note}</div>}
                <div className="mono small muted" style={{ marginTop: 6 }}>
                  {last
                    ? t('workout.lastTime', { date: last.date.slice(5), sets: last.sets })
                    : t('workout.firstTime')}
                </div>
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
