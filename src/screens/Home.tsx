import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/PageHeader';
import { WorkoutList } from '../components/WorkoutList';
import { nextRoutine } from '../lib/routines';
import { kindOf, type Workout } from '../lib/types';
import { displayVolume } from '../lib/units';
import { computeVolume } from '../lib/volume';
import { useStore } from '../state/useStore';

type WeekDay = { iso: string; label: string };

export function weekDays(now = new Date(), language = 'en'): WeekDay[] {
  const locale = language.startsWith('it') ? 'it-IT' : 'en-GB';
  const monday = new Date(now);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return {
      iso: day.toLocaleDateString('sv'),
      label: day.toLocaleDateString(locale, { weekday: 'narrow' }).toLocaleUpperCase(locale),
    };
  });
}

function workingSetCount(workout: Workout): number {
  return workout.sets.filter((set) => set.done && kindOf(set.kind) === 'working').length;
}

export function Home() {
  const { t, i18n } = useTranslation();
  const { active, folders, routines, settings, workouts } = useStore();
  const nav = useStore((state) => state.nav);
  const startWorkout = useStore((state) => state.startWorkout);
  const ensureCatalog = useStore((state) => state.ensureCatalog);
  const days = weekDays(new Date(), i18n.language);
  const daySet = new Set(days.map((day) => day.iso));
  const weeklyWorkouts = workouts.filter(
    (workout) => daySet.has(workout.date) && workingSetCount(workout) > 0,
  );
  const workingSets = weeklyWorkouts.reduce(
    (total, workout) => total + workingSetCount(workout),
    0,
  );
  const weeklyVolume = weeklyWorkouts.reduce(
    (total, workout) => total + computeVolume(workout.sets),
    0,
  );
  const next = nextRoutine(routines, folders, workouts);
  const today = new Date().toLocaleDateString('sv');
  const unit = settings.unit ?? 'kg';
  const locale = i18n.language === 'it' ? 'it-IT' : 'en-GB';

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

        <section className="home-week" aria-labelledby="week-summary">
          <h2 id="week-summary" className="display section-title home-section-title">
            {t('home.thisWeek')}
          </h2>
          <div className="week-band">
            <div className="week-days" aria-label={t('home.weekDays')}>
              {days.map((day) => {
                const trained = weeklyWorkouts.some((workout) => workout.date === day.iso);
                return (
                  <span
                    key={day.iso}
                    className={`week-day${trained ? ' week-day--trained' : ''}`}
                    aria-label={`${day.iso}${trained ? ` ${t('home.trained')}` : ''}`}
                    aria-current={day.iso === today ? 'date' : undefined}
                  >
                    {day.label}
                  </span>
                );
              })}
            </div>
            <div className="week-metrics">
              <span className="week-metric">
                <strong className="display">{weeklyWorkouts.length}</strong>
                <span>
                  {t('home.sessions', {
                    count: weeklyWorkouts.length,
                  })}
                </span>
              </span>
              <span className="week-metric">
                <strong className="display">{workingSets}</strong>
                <span>{t('home.workingSets', { count: workingSets })}</span>
              </span>
              <span className="week-metric week-metric--volume">
                <strong className="display">
                  {displayVolume(weeklyVolume, unit).toLocaleString(locale)} {unit}
                </strong>
                <span>{t('home.volume')}</span>
              </span>
            </div>
          </div>
        </section>
      </div>

      <section className="home-recent" aria-labelledby="recent-workouts">
        <div className="home-section-heading">
          <h2 id="recent-workouts" className="display section-title">
            {t('home.recent')}
          </h2>
          <button className="home-history-link" onClick={() => nav({ view: 'history' })}>
            {t('home.allHistory')}
          </button>
        </div>
        {workouts.length > 0 ? (
          <WorkoutList
            workouts={workouts}
            limit={3}
            onOpen={(workout) => nav({ view: 'workoutDetail', id: workout.id })}
          />
        ) : (
          <p className="muted small">{t('history.empty')}</p>
        )}
      </section>
    </div>
  );
}
