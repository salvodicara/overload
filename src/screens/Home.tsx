import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconBack, IconForward } from '../components/Icons';
import { PageHeader } from '../components/PageHeader';
import { WorkoutList } from '../components/WorkoutList';
import { nextRoutine } from '../lib/routines';
import { kindOf, type Workout } from '../lib/types';
import { displayVolume } from '../lib/units';
import { computeVolume } from '../lib/volume';
import { useStore } from '../state/useStore';

type WeekDay = { iso: string; label: string };

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

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

export function weekRangeLabel(days: WeekDay[], language: string): string {
  const locale = language.startsWith('it') ? 'it-IT' : 'en-GB';
  const first = new Date(`${days[0].iso}T12:00:00`);
  const last = new Date(`${days.at(-1)!.iso}T12:00:00`);
  const sameMonth =
    first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear();
  if (sameMonth) {
    return `${first.getDate()}–${last.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}`;
  }
  return `${first.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – ${last.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}`;
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
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const days = weekDays(weekAnchor, i18n.language);
  const currentDays = weekDays(new Date(), i18n.language);
  const previousDays = weekDays(addDays(weekAnchor, -7), i18n.language);
  const daySet = new Set(days.map((day) => day.iso));
  const previousDaySet = new Set(previousDays.map((day) => day.iso));
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
  const previousWorkouts = workouts.filter(
    (workout) => previousDaySet.has(workout.date) && workingSetCount(workout) > 0,
  );
  const previousSetsCount = previousWorkouts.reduce(
    (total, workout) => total + workingSetCount(workout),
    0,
  );
  const previousVolume = previousWorkouts.reduce(
    (total, workout) => total + computeVolume(workout.sets),
    0,
  );
  const next = nextRoutine(routines, folders, workouts, settings.programStartDate);
  const today = new Date().toLocaleDateString('sv');
  const unit = settings.unit ?? 'kg';
  const locale = i18n.language === 'it' ? 'it-IT' : 'en-GB';
  const isCurrentWeek = days[0].iso === currentDays[0].iso;
  const signed = (value: number) =>
    new Intl.NumberFormat(locale, { signDisplay: 'always', maximumFractionDigits: 1 }).format(
      value,
    );

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
          <div className="home-week-heading">
            <div>
              <h2 id="week-summary" className="display section-title home-section-title">
                {isCurrentWeek ? t('home.thisWeek') : t('home.selectedWeek')}
              </h2>
              <span className="mono small muted">{weekRangeLabel(days, i18n.language)}</span>
            </div>
            <div className="home-week-nav">
              <button
                type="button"
                className="iconbtn"
                aria-label={t('home.previousWeek')}
                onClick={() => setWeekAnchor((date) => addDays(date, -7))}
              >
                <IconBack />
              </button>
              <button
                type="button"
                className="iconbtn"
                aria-label={t('home.nextWeek')}
                disabled={isCurrentWeek}
                onClick={() => setWeekAnchor((date) => addDays(date, 7))}
              >
                <IconForward />
              </button>
            </div>
          </div>
          <div className="week-band">
            <div className="week-days" aria-label={t('home.weekDays')}>
              {days.map((day) => {
                const dayWorkouts = weeklyWorkouts.filter((workout) => workout.date === day.iso);
                const trained = dayWorkouts.length > 0;
                const className = `week-day${trained ? ' week-day--trained' : ''}`;
                const label = `${day.iso}${trained ? ` ${t('home.trained')}` : ''}`;
                return trained ? (
                  <button
                    type="button"
                    key={day.iso}
                    className={className}
                    aria-label={label}
                    aria-current={day.iso === today ? 'date' : undefined}
                    onClick={() => {
                      const latest = [...dayWorkouts].sort((a, b) => b.startTs - a.startTs)[0];
                      nav({ view: 'workoutDetail', id: latest.id });
                    }}
                  >
                    {day.label}
                  </button>
                ) : (
                  <span
                    key={day.iso}
                    className={className}
                    aria-label={label}
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
            <p className="home-week-comparison mono small muted">
              {t('home.weekComparison', {
                workouts: signed(weeklyWorkouts.length - previousWorkouts.length),
                sets: signed(workingSets - previousSetsCount),
                volume: signed(displayVolume(weeklyVolume - previousVolume, unit)),
                unit,
              })}
            </p>
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
