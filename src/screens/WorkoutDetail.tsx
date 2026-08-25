import { IconBack } from '../components/Icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { exerciseName } from '../lib/exercises';
import { continueAccountAction, useStore } from '../state/useStore';
import type { SetLog } from '../lib/types';

function fmtDate(iso: string, locale: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(locale === 'it' ? 'it-IT' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Sets bucketed per exercise, first-appearance order preserved. */
function byExercise(sets: SetLog[]): { exerciseId: string; sets: SetLog[] }[] {
  const out: { exerciseId: string; sets: SetLog[] }[] = [];
  for (const s of sets) {
    const found = out.find((g) => g.exerciseId === s.exerciseId);
    if (found) found.sets.push(s);
    else out.push({ exerciseId: s.exerciseId, sets: [s] });
  }
  return out;
}

export function WorkoutDetail({ id }: { id: string }) {
  const { t, i18n } = useTranslation();
  const { workouts, catalogReady } = useStore();
  const nav = useStore((s) => s.nav);
  const deleteWorkout = useStore((s) => s.deleteWorkout);
  const [confirming, setConfirming] = useState(false);

  const w = workouts.find((x) => x.id === id);
  if (!w) {
    nav({ view: 'home' });
    return null;
  }
  void catalogReady; // re-render exercise names once the catalog resolves

  const groups = byExercise(w.sets);

  return (
    <div className="screen">
      <div className="row" style={{ padding: '14px 0 10px' }}>
        <button className="iconbtn" aria-label={t('common.back')} onClick={() => history.back()}>
          <IconBack />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mono small muted">{fmtDate(w.date, i18n.language)}</div>
          <div
            className="display"
            style={{ fontSize: 22, color: w.dayLabel ? undefined : 'var(--muted)' }}
          >
            {w.dayLabel ?? '-'}
          </div>
        </div>
      </div>

      <div className="card card-pad spread">
        <div>
          <div className="mono small muted">{t('summary.volume')}</div>
          <div className="mono" style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.1 }}>
            {Math.round(w.volumeKg).toLocaleString(i18n.language)}
          </div>
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span className="chip">{t('history.sets', { n: w.sets.length })}</span>
          {w.source !== 'app' && <span className="chip">{t('history.imported')}</span>}
        </div>
      </div>

      <div className="stack" style={{ marginTop: 12 }}>
        {groups.map((g) => (
          <div key={g.exerciseId} className="card card-pad">
            <button
              style={{ fontWeight: 700, fontSize: 16, textAlign: 'left' }}
              onClick={() => nav({ view: 'exercise', id: g.exerciseId })}
            >
              {exerciseName(g.exerciseId, i18n.language)}
            </button>
            <div className="stack" style={{ gap: 4, marginTop: 8 }}>
              {g.sets.map((s, i) => (
                <div key={i} className="row mono small">
                  <span className="muted" style={{ minWidth: 18 }}>
                    {i + 1}
                  </span>
                  <span>
                    · {s.weightKg.toLocaleString(i18n.language)} {t('workout.kg')} × {s.reps}
                  </span>
                  {s.isPr && (
                    <span style={{ color: 'var(--good)', fontWeight: 700 }}>{t('history.pr')}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {w.note && (
        <div className="card card-pad small muted" style={{ marginTop: 12 }}>
          {w.note}
        </div>
      )}

      <button
        className="btn btn-danger btn-block"
        style={{ marginTop: 20 }}
        onClick={() => setConfirming(true)}
      >
        {t('history.delete')}
      </button>

      {confirming && (
        <div className="sheet-scrim" role="dialog" aria-modal="true">
          <div className="sheet card card-pad stack">
            <strong>{t('history.delete')}</strong>
            <span className="muted small">{t('history.deleteBody')}</span>
            <button
              className="btn btn-danger btn-block"
              onClick={() => {
                void continueAccountAction(deleteWorkout(w.id), () => nav({ view: 'home' }));
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
