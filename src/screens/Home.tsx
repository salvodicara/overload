import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../state/useStore';
import { fmtDate, todayISO } from '../lib/format';

export function Home() {
  const { t, i18n } = useTranslation();
  const { settings, workouts, routines, active, syncState, user } = useStore();
  const nav = useStore((s) => s.nav);
  const startWorkout = useStore((s) => s.startWorkout);
  const updateSettings = useStore((s) => s.updateSettings);
  const phase = useStore((s) => s.phase)();
  const [pickDate, setPickDate] = useState(false);

  // Prefer a routine that actually has content; a freshly created empty
  // routine must not hijack the home screen after a relaunch.
  const routine =
    routines.find((r) => r.days.some((d) => d.exercises.length > 0)) ?? routines[0];
  const lastApp = workouts.find((w) => w.source === 'app' && w.routineId === routine?.id);
  const lastDayIndex = lastApp
    ? routine?.days.findIndex((d) => lastApp.dayLabel?.startsWith(d.label)) ?? -1
    : -1;
  const suggested = routine ? (lastDayIndex + 1) % routine.days.length : 0;

  return (
    <div className="screen">
      <div className="spread" style={{ padding: '22px 0 6px' }}>
        <div className="display" style={{ fontSize: 30 }}>
          {t('app.name')}
        </div>
        <button
          className="account-btn"
          onClick={() => nav({ view: 'settings' })}
          aria-label={t('settings.title')}
        >
          <span className="account-avatar">{(user?.name ?? 'O').charAt(0).toUpperCase()}</span>
          <span
            className="account-dot"
            title={t(`settings.sync.${syncState}`)}
            style={{
              background:
                syncState === 'synced'
                  ? 'var(--good)'
                  : syncState === 'error'
                    ? 'var(--danger)'
                    : 'var(--muted)',
            }}
          />
        </button>
      </div>

      {!settings.programStartDate ? (
        <div className="card card-pad stack" style={{ marginTop: 12 }}>
          <strong>{t('home.setStartTitle')}</strong>
          <span className="muted small">{t('home.setStartBody')}</span>
          <button
            className="btn btn-accent btn-block"
            onClick={() => void updateSettings({ programStartDate: todayISO() })}
          >
            {t('home.startToday')}
          </button>
          {pickDate ? (
            <input
              type="date"
              aria-label={t('home.pickDate')}
              onChange={(e) => e.target.value && void updateSettings({ programStartDate: e.target.value })}
            />
          ) : (
            <button className="btn btn-ghost btn-block" onClick={() => setPickDate(true)}>
              {t('home.pickDate')}
            </button>
          )}
        </div>
      ) : phase ? (
        <div className="card card-pad" style={{ marginTop: 12 }}>
          <div className="spread">
            <strong>{t(`phase.${phase.key}`)}</strong>
            <span className="mono small muted">{t('phase.week', { n: phase.week })}</span>
          </div>
          <div className="row" style={{ gap: 3, margin: '10px 0 8px' }}>
            {Array.from({ length: 9 }, (_, i) => (
              <span
                key={i}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  background: i < Math.min(phase.week, 9) ? 'var(--accent)' : 'var(--surface2)',
                }}
              />
            ))}
          </div>
          <span className="muted small">{t(`phase.hint.${phase.key}`)}</span>
        </div>
      ) : null}

      {active && (
        <button
          className="btn btn-solid btn-block"
          style={{ marginTop: 12 }}
          onClick={() => nav({ view: 'workout' })}
        >
          {t('home.resume')}
        </button>
      )}

      {!routine && (
        <div className="card card-pad stack" style={{ marginTop: 16 }}>
          <span className="display" style={{ fontSize: 24 }}>{t('home.welcomeTitle')}</span>
          <span className="muted small">{t('home.welcomeBody')}</span>
          <button className="btn btn-accent btn-block" onClick={() => nav({ view: 'routines' })}>
            {t('home.welcomeCta')}
          </button>
        </div>
      )}

      <div className="stack" style={{ marginTop: 20 }}>
        {routine?.days.map((day, di) => {
          const last = workouts.find(
            (w) => w.source === 'app' && w.dayLabel?.startsWith(day.label),
          );
          const isNext = di === suggested;
          return (
            <div key={day.label} className="card card-pad row">
              <div
                style={{
                  width: 4,
                  alignSelf: 'stretch',
                  borderRadius: 2,
                  background: isNext ? 'var(--accent)' : 'var(--surface2)',
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mono small muted row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ whiteSpace: 'nowrap' }}>
                    {day.label} · {t('home.exercises', { n: day.exercises.length })}
                  </span>
                  {isNext && <span className="chip chip-accent">{t('home.suggested')}</span>}
                </div>
                <div className="display" style={{ fontSize: 22 }}>
                  {day.name}
                </div>
                <div className="small muted">
                  {last
                    ? t('home.lastDone', {
                        date: fmtDate(last.date, i18n.language),
                        vol: Math.round(last.volumeKg).toLocaleString(i18n.language),
                      })
                    : t('home.never')}
                </div>
              </div>
              <button
                className={`btn ${isNext ? 'btn-accent' : 'btn-ghost'}`}
                onClick={() => startWorkout(routine.id, di)}
              >
                {t('home.start')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
