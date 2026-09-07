import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/PageHeader';
import { formatCompactNumber } from '../lib/format';
import { nextRoutine } from '../lib/routines';
import { periodSummary, weekDays, weekRangeLabel } from '../lib/trainingPeriods';
import { kindOf } from '../lib/types';
import { useStore } from '../state/useStore';
import '../theme/overview.css';

export { weekDays, weekRangeLabel } from '../lib/trainingPeriods';

export function Home() {
  const { t, i18n } = useTranslation();
  const { active, folders, routines, settings, workouts, nav, startWorkout, ensureCatalog } =
    useStore();
  const now = new Date();
  const today = now.toLocaleDateString('sv');
  const days = weekDays(now, i18n.language);
  const summary = periodSummary(now, 'week', workouts, now);
  const trainedDays = new Set(
    workouts
      .filter((workout) => workout.sets.some((set) => set.done && kindOf(set.kind) === 'working'))
      .map((workout) => workout.date),
  );
  const next = nextRoutine(routines, folders, workouts, settings.programStartDate);
  const locale = i18n.language.startsWith('it') ? 'it-IT' : 'en-GB';
  useEffect(() => {
    if (workouts.length > 0) return;
    const load = () => void ensureCatalog().catch(() => {});
    const idleWindow = window as Window & {
      requestIdleCallback?: typeof window.requestIdleCallback;
      cancelIdleCallback?: typeof window.cancelIdleCallback;
    };
    if (idleWindow.requestIdleCallback) {
      const id = idleWindow.requestIdleCallback(load, { timeout: 2_000 });
      return () => idleWindow.cancelIdleCallback?.(id);
    }
    const id = setTimeout(load, 2_000);
    return () => clearTimeout(id);
  }, [ensureCatalog, workouts.length]);

  return (
    <div className="screen page home-screen">
      <PageHeader title={t('app.name')} />
      <div className="home-overview">
        <section
          className="home-primary-action"
          aria-labelledby={active ? 'resume-workout' : next ? 'next-workout' : 'build-plan'}
        >
          {active ? (
            <>
              <h2 id="resume-workout" className="home-primary-action__title">
                {t('home.resume')}
              </h2>
              <button
                className="btn btn-block home-primary-action__button"
                onClick={() => nav({ view: 'workout' })}
              >
                {t('activeBar.resume')}
              </button>
              {next && (
                <section className="home-up-next" aria-labelledby="next-workout">
                  <h3 id="next-workout" className="home-up-next__title">
                    {t('home.nextWorkout')}
                  </h3>
                  <div className="home-up-next__detail">
                    <strong>{next.name}</strong>
                    <span>
                      {t('home.exercises', {
                        count: next.exercises.length,
                      })}
                    </span>
                  </div>
                </section>
              )}
            </>
          ) : next ? (
            <>
              <h2 id="next-workout" className="home-primary-action__title">
                {t('home.nextWorkout')}
              </h2>
              <div className="home-primary-action__routine">
                <strong>{next.name}</strong>
                <span>
                  {t('home.exercises', {
                    count: next.exercises.length,
                  })}
                </span>
              </div>
              <button
                className="btn btn-block home-primary-action__button"
                onClick={() => startWorkout(next.id)}
              >
                {t('home.start')}
              </button>
            </>
          ) : (
            <>
              <h2 id="build-plan" className="home-primary-action__title">
                {t('home.welcomeTitle')}
              </h2>
              <p className="home-primary-action__body">{t('home.welcomeBody')}</p>
              <button
                className="btn btn-block home-primary-action__button"
                onClick={() => nav({ view: 'train' })}
              >
                {t('home.welcomeCta')}
              </button>
            </>
          )}
        </section>

        <section className="home-week home-current-week" aria-labelledby="current-week-title">
          <div className="home-week-heading">
            <h2 id="current-week-title" className="display section-title">
              {t('home.thisWeek')}
            </h2>
            <span className="mono small muted">{weekRangeLabel(days, i18n.language)}</span>
          </div>
          <div className="week-days" role="group" aria-label={t('home.weekDays')}>
            {days.map((day) => (
              <span
                key={day.iso}
                className={`week-day${trainedDays.has(day.iso) ? ' week-day--trained' : ''}`}
                aria-label={`${day.iso}${trainedDays.has(day.iso) ? ` ${t('home.trained')}` : ''}`}
                aria-current={day.iso === today ? 'date' : undefined}
              >
                {day.label}
              </span>
            ))}
          </div>
          <dl className="home-week-totals">
            {[
              [t('home.sessions', { count: summary.workouts }), summary.workouts],
              [t('home.workingSets', { count: summary.workingSets }), summary.workingSets],
              [t('home.duration'), summary.durationMin],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd className="display">{formatCompactNumber(Number(value), locale)}</dd>
              </div>
            ))}
          </dl>
          <div className="home-shortcuts">
            <button
              type="button"
              className="home-history-link"
              onClick={() => nav({ view: 'history' })}
            >
              {t('home.allHistory')} <span aria-hidden>→</span>
            </button>
            <button
              type="button"
              className="home-progress-link"
              onClick={() => nav({ view: 'progress' })}
            >
              {t('home.viewProgress')} <span aria-hidden>→</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
