import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSurfaceState } from '../hooks/useSurfaceState';
import { PeriodPager } from '../components/PeriodPager';
import { replaceSurfaceState } from '../lib/navigationState';
import { IconBack, IconForward } from '../components/Icons';
import { PageHeader } from '../components/PageHeader';
import { WorkoutList } from '../components/WorkoutList';
import { formatCompactNumber } from '../lib/format';
import { nextRoutine } from '../lib/routines';
import {
  periodSummary,
  periodBounds,
  shiftPeriod,
  weekDays,
  weekRangeLabel,
} from '../lib/trainingPeriods';
import { kindOf } from '../lib/types';
import { useStore } from '../state/useStore';
import '../theme/overview.css';
import '../theme/home.css';

export { weekDays, weekRangeLabel } from '../lib/trainingPeriods';

export function Home() {
  const { t, i18n } = useTranslation();
  const { active, folders, routines, settings, workouts, nav, startWorkout, ensureCatalog } =
    useStore();
  const now = new Date();
  const today = now.toLocaleDateString('sv');
  const [surface, setSurface] = useSurfaceState('home', {});
  const anchor =
    surface.periodAnchor && surface.periodAnchor <= today ? surface.periodAnchor : today;
  const selectedWeek = new Date(`${anchor}T12:00:00`);
  const isCurrentWeek =
    periodBounds(selectedWeek, 'week').start === periodBounds(now, 'week').start;
  const moveWeek = (direction: -1 | 1) => {
    if (direction > 0 && isCurrentWeek) return;
    setSurface((current) => ({
      ...current,
      periodAnchor: shiftPeriod(selectedWeek, 'week', direction).toLocaleDateString('sv'),
    }));
  };
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
              <button
                className="home-primary-action__routine"
                aria-label={t('routines.view', { routine: next.name })}
                onClick={() => nav({ view: 'routine', id: next.id })}
              >
                <strong>{next.name}</strong>
                <span>
                  {t('home.exercises', {
                    count: next.exercises.length,
                  })}
                </span>
                <IconForward />
              </button>
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
            <h2 id="current-week-title" className="section-title">
              {t(isCurrentWeek ? 'home.thisWeek' : 'home.selectedWeek')}
            </h2>
            {!isCurrentWeek && (
              <button
                className="period-return"
                onClick={() => setSurface((current) => ({ ...current, periodAnchor: today }))}
              >
                {t('home.today')}
              </button>
            )}
          </div>
          <div className="period-navigation">
            <button
              className="iconbtn"
              aria-label={t('home.previousWeek')}
              onClick={() => moveWeek(-1)}
            >
              <IconBack />
            </button>
            <p className="period-navigation__label" aria-live="polite">
              {weekRangeLabel(weekDays(selectedWeek, i18n.language), i18n.language)}
            </p>
            <button
              className="iconbtn"
              aria-label={t('home.nextWeek')}
              disabled={isCurrentWeek}
              onClick={() => moveWeek(1)}
            >
              <IconForward />
            </button>
          </div>
          <PeriodPager
            value={anchor}
            label={t('home.weekDays')}
            onMove={moveWeek}
            canNext={!isCurrentWeek}
          >
            {(offset) => {
              const date = shiftPeriod(selectedWeek, 'week', offset);
              const days = weekDays(date, i18n.language);
              const summary = periodSummary(date, 'week', workouts, now);
              return (
                <div>
                  <div className="week-days" role="group" aria-label={t('home.weekDays')}>
                    {days.map((day) => (
                      <span
                        key={day.iso}
                        className={`week-day${trainedDays.has(day.iso) ? ' week-day--trained' : ''}`}
                        aria-label={`${day.iso}${trainedDays.has(day.iso) ? ` ${t('home.trained')}` : ''}`}
                        aria-current={day.iso === today ? 'date' : undefined}
                      >
                        <span className="home-weekday-label">{day.label}</span>
                        <strong>{Number(day.iso.slice(-2))}</strong>
                      </span>
                    ))}
                  </div>
                  {summary.workouts === 0 && (
                    <p className="home-empty-guidance small muted">{t('home.emptyWeek')}</p>
                  )}
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
                </div>
              );
            }}
          </PeriodPager>
          <div className="home-shortcuts">
            {workouts.length === 0 && (
              <button
                type="button"
                className="home-history-link"
                onClick={() => nav({ view: 'history' })}
              >
                {t('home.allHistory')} <IconForward />
              </button>
            )}
            <button
              type="button"
              className="home-progress-link"
              onClick={() => {
                nav({ view: 'progress' });
                replaceSurfaceState('progress', { periodUnit: 'week', periodAnchor: anchor });
              }}
            >
              {t('home.viewProgress')} <IconForward />
            </button>
          </div>
        </section>
      </div>
      {workouts.length > 0 && (
        <section className="home-recent" aria-labelledby="recent-workouts-title">
          <div className="home-section-heading">
            <h2 id="recent-workouts-title" className="section-title">
              {t('home.recent')}
            </h2>
            <button
              type="button"
              className="home-history-link"
              onClick={() => nav({ view: 'history' })}
            >
              {t('home.allHistory')} <IconForward />
            </button>
          </div>
          <WorkoutList
            workouts={workouts}
            limit={3}
            onOpen={(workout) => nav({ view: 'workoutDetail', id: workout.id })}
          />
        </section>
      )}
    </div>
  );
}
