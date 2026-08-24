import { useTranslation } from 'react-i18next';
import { exerciseName } from '../lib/exercises';
import { fmtDate } from '../lib/format';
import { useStore } from '../state/useStore';
import type { Workout } from '../lib/types';

function isoWeekKey(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toLocaleDateString('sv');
}

/** Hevy-style exercise summary: "3 × Panca piana manubri" per exercise. */
function exerciseLines(w: Workout, locale: string): { label: string; extra: number } {
  const counts = new Map<string, number>();
  for (const s of w.sets) counts.set(s.exerciseId, (counts.get(s.exerciseId) ?? 0) + 1);
  const entries = [...counts.entries()];
  const shown = entries.slice(0, 4);
  return {
    label: shown.map(([id, n]) => `${n} × ${exerciseName(id, locale)}`).join('\n'),
    extra: entries.length - shown.length,
  };
}

export function History() {
  const { t, i18n } = useTranslation();
  const { workouts, user } = useStore();
  const nav = useStore((s) => s.nav);

  const weekKey = isoWeekKey(new Date().toLocaleDateString('sv'));
  const thisWeek = workouts.filter((w) => isoWeekKey(w.date) === weekKey);
  const weekVolume = thisWeek.reduce((a, w) => a + w.volumeKg, 0);

  let lastMonth = '';

  return (
    <div className="screen">
      <div className="spread" style={{ padding: '22px 0 6px' }}>
        <div className="display" style={{ fontSize: 30 }}>
          {t('app.name')}
        </div>
        <button
          className="account-btn"
          onClick={() => nav({ view: 'profile' })}
          aria-label={t('nav.profile')}
        >
          <span className="account-avatar">{(user?.name ?? 'O').charAt(0).toUpperCase()}</span>
        </button>
      </div>

      <div className="card card-pad row" style={{ marginBottom: 6 }}>
        <div style={{ flex: 1 }}>
          <div className="mono small muted" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {t('home.thisWeek')}
          </div>
          <div className="row" style={{ gap: 18, marginTop: 4 }}>
            <span>
              <span className="display" style={{ fontSize: 26 }}>{thisWeek.length}</span>{' '}
              <span className="small muted">{t('home.sessions')}</span>
            </span>
            <span>
              <span className="display" style={{ fontSize: 26 }}>
                {Math.round(weekVolume).toLocaleString(i18n.language)}
              </span>{' '}
              <span className="small muted">kg</span>
            </span>
          </div>
        </div>
      </div>

      {workouts.length === 0 && (
        <div className="empty">
          {t('history.empty')}
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-accent" onClick={() => nav({ view: 'train' })}>
              {t('home.start')}
            </button>
          </div>
        </div>
      )}

      <div className="stack" style={{ marginTop: 10 }}>
        {workouts.map((w) => {
          const month = new Date(`${w.date}T12:00:00`).toLocaleDateString(
            i18n.language === 'it' ? 'it-IT' : 'en-GB',
            { month: 'long', year: 'numeric' },
          );
          const header =
            month !== lastMonth ? (
              <div
                key={`m-${month}`}
                className="mono small muted"
                style={{ letterSpacing: '0.1em', textTransform: 'uppercase', margin: '14px 0 2px' }}
              >
                {month}
              </div>
            ) : null;
          lastMonth = month;
          const mins = w.endTs ? Math.max(1, Math.round((w.endTs - w.startTs) / 60000)) : null;
          const hasPr = w.sets.some((s) => s.isPr);
          const lines = exerciseLines(w, i18n.language);
          return (
            <div key={w.id} style={{ display: 'contents' }}>
              {header}
              <button
                className="card card-pad stack"
                style={{ width: '100%', textAlign: 'left', gap: 8 }}
                onClick={() => nav({ view: 'workoutDetail', id: w.id })}
              >
                <div className="spread">
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{w.dayLabel ?? t('nav.workout')}</span>
                  <span className="mono small muted">{fmtDate(w.date, i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                </div>
                <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                  {mins !== null && <span className="chip">{t('summary.duration', { min: mins })}</span>}
                  <span className="chip mono">{Math.round(w.volumeKg).toLocaleString(i18n.language)} kg</span>
                  <span className="chip">{t('history.sets', { n: w.sets.length })}</span>
                  {hasPr && <span className="chip chip-good">{t('history.pr')}</span>}
                  {w.source !== 'app' && <span className="chip">{t('history.imported')}</span>}
                </div>
                <div className="small muted" style={{ whiteSpace: 'pre-line', lineHeight: 1.6 }}>
                  {lines.label}
                  {lines.extra > 0 && `\n${t('home.moreExercises', { n: lines.extra })}`}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
