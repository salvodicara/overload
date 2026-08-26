import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { LineChart } from '../components/LineChart';
import { PageHeader } from '../components/PageHeader';
import { WorkoutList } from '../components/WorkoutList';
import { formatCompactNumber } from '../lib/format';
import { nextRoutine } from '../lib/routines';
import {
  periodBounds,
  periodBuckets,
  periodSummary,
  shiftPeriod,
  type PeriodUnit,
  type TrainingMetrics,
} from '../lib/trainingPeriods';
import { kindOf, type Workout } from '../lib/types';
import { displayVolume } from '../lib/units';
import { useStore } from '../state/useStore';

type WeekDay = { iso: string; label: string };
type PeriodMotion = 'idle' | 'previous' | 'next' | 'today';

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
  const [periodAnchor, setPeriodAnchor] = useState(() => new Date());
  const [periodUnit, setPeriodUnit] = useState<PeriodUnit>('week');
  const [chartMetric, setChartMetric] = useState<keyof TrainingMetrics>('volume');
  const [dragX, setDragX] = useState(0);
  const [periodMotion, setPeriodMotion] = useState<PeriodMotion>('idle');
  const swipeStartX = useRef<number | null>(null);
  const days = weekDays(periodAnchor, i18n.language);
  const currentDays = weekDays(new Date(), i18n.language);
  const now = new Date();
  const bounds = periodBounds(periodAnchor, periodUnit);
  const currentBounds = periodBounds(now, periodUnit);
  const earliestWorkoutDate = workouts.reduce<string | null>(
    (earliest, workout) =>
      workingSetCount(workout) > 0 && (!earliest || workout.date < earliest)
        ? workout.date
        : earliest,
    null,
  );
  const earliestBounds = periodBounds(
    earliestWorkoutDate ? new Date(`${earliestWorkoutDate}T12:00:00`) : now,
    periodUnit,
  );
  const summary = periodSummary(periodAnchor, periodUnit, workouts, now);
  const buckets = periodBuckets(periodAnchor, periodUnit, workouts, now);
  const periodWorkouts = workouts.filter(
    (workout) =>
      workout.date >= bounds.start && workout.date <= bounds.end && workingSetCount(workout) > 0,
  );
  const next = nextRoutine(routines, folders, workouts, settings.programStartDate);
  const today = new Date().toLocaleDateString('sv');
  const unit = settings.unit ?? 'kg';
  const locale = i18n.language === 'it' ? 'it-IT' : 'en-GB';
  const isCurrentPeriod = bounds.start === currentBounds.start;
  const isEarliestPeriod = bounds.start <= earliestBounds.start;
  const signed = (value: number) =>
    `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatCompactNumber(Math.abs(value), locale)}`;
  const metricDelta = (
    current: number,
    previous: number,
    format: 'absolute' | 'percentage' = 'absolute',
  ) => {
    const difference = current - previous;
    const direction = difference > 0 ? 'increase' : difference < 0 ? 'decrease' : 'neutral';
    if (difference === 0) return { direction, text: '—' };
    if (format === 'percentage' && previous === 0) {
      return { direction, text: t('home.new') };
    }
    const value = format === 'percentage' ? (difference / previous) * 100 : difference;
    return {
      direction,
      text: `${difference > 0 ? '↑' : '↓'} ${signed(value)}${format === 'percentage' ? '%' : ''}`,
    };
  };
  const deltas = {
    workouts: metricDelta(summary.workouts, summary.previous.workouts),
    workingSets: metricDelta(summary.workingSets, summary.previous.workingSets),
    volume: metricDelta(summary.volume, summary.previous.volume, 'percentage'),
    durationMin: metricDelta(summary.durationMin, summary.previous.durationMin),
  };
  const periodLabel =
    periodUnit === 'week'
      ? weekRangeLabel(days, i18n.language)
      : periodUnit === 'month'
        ? new Date(`${bounds.start}T12:00:00`).toLocaleDateString(locale, {
            month: 'long',
            year: 'numeric',
          })
        : bounds.start.slice(0, 4);
  const periodTitle = isCurrentPeriod
    ? t(`home.this${periodUnit[0].toUpperCase()}${periodUnit.slice(1)}`)
    : t(`home.selected${periodUnit[0].toUpperCase()}${periodUnit.slice(1)}`);
  const monthLeadingDays = (new Date(`${bounds.start}T12:00:00`).getDay() + 6) % 7;
  const monthDayCount = Number(bounds.end.slice(-2));
  const monthTrailingDays = 42 - monthLeadingDays - monthDayCount;
  const chartPoints = buckets.map((bucket) => ({
    date: bucket.date,
    value: chartMetric === 'volume' ? displayVolume(bucket.volume, unit) : bucket[chartMetric],
  }));
  const chartValue = (value: number) =>
    chartMetric === 'volume'
      ? `${formatCompactNumber(value, locale)} ${unit}`
      : chartMetric === 'durationMin'
        ? `${formatCompactNumber(value, locale)} min`
        : formatCompactNumber(value, locale);
  const exact = (value: number) =>
    Number.isFinite(value)
      ? new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)
      : '—';

  function movePeriod(amount: -1 | 1): void {
    if (amount > 0 && isCurrentPeriod) return;
    if (amount < 0 && isEarliestPeriod) return;
    setPeriodMotion(amount < 0 ? 'previous' : 'next');
    setPeriodAnchor((anchor) => shiftPeriod(anchor, periodUnit, amount));
  }

  function trackSwipe(clientX: number): number {
    const start = swipeStartX.current;
    if (start === null) return 0;
    const raw = clientX - start;
    const atBoundary = (isCurrentPeriod && raw < 0) || (isEarliestPeriod && raw > 0);
    const resisted = atBoundary ? raw * 0.2 : raw;
    setDragX(Math.max(-280, Math.min(280, resisted)));
    return resisted;
  }

  function finishSwipe(event: PointerEvent<HTMLDivElement>): void {
    const start = swipeStartX.current;
    swipeStartX.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* synthetic pointers and older browsers may not hold capture */
    }
    event.currentTarget.blur();
    const distance = start === null ? 0 : event.clientX - start;
    setDragX(0);
    if (Math.abs(distance) < 48) return;
    movePeriod(distance > 0 ? -1 : 1);
  }

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

        <section className="home-week" aria-labelledby="period-summary">
          <div className="home-period-tabs" role="tablist" aria-label={t('home.trainingPeriod')}>
            {(['week', 'month', 'year'] as const).map((unitName) => (
              <button
                key={unitName}
                role="tab"
                aria-selected={periodUnit === unitName}
                onClick={() => {
                  setPeriodUnit(unitName);
                  setPeriodAnchor(new Date());
                  setPeriodMotion('today');
                }}
              >
                {t(`home.${unitName}`)}
              </button>
            ))}
          </div>
          <div
            className="home-period-overview"
            role="group"
            tabIndex={0}
            aria-label={t('home.periodNavigation')}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') movePeriod(-1);
              if (event.key === 'ArrowRight') movePeriod(1);
            }}
          >
            <div className="home-week-heading">
              <div>
                <h2 id="period-summary" className="display section-title home-section-title">
                  {periodTitle}
                </h2>
                <span className="home-period-label mono small muted" aria-live="polite">
                  {periodUnit === 'year' ? '\u00A0' : periodLabel}
                </span>
              </div>
              <div className="home-period-today-slot">
                {!isCurrentPeriod && (
                  <button
                    type="button"
                    className="home-period-today"
                    onClick={() => {
                      setPeriodMotion('today');
                      setPeriodAnchor(new Date());
                    }}
                  >
                    {t('home.today')}
                  </button>
                )}
              </div>
            </div>
            <div className="week-band">
              <div
                className="home-period-pager"
                data-unit={periodUnit}
                onPointerDown={(event) => {
                  swipeStartX.current = event.clientX;
                  setPeriodMotion('idle');
                }}
                onPointerMove={(event) => {
                  if (Math.abs(trackSwipe(event.clientX)) < 8) return;
                  try {
                    event.currentTarget.setPointerCapture(event.pointerId);
                  } catch {
                    /* pointer capture is an enhancement */
                  }
                }}
                onPointerUp={finishSwipe}
                onPointerCancel={() => {
                  swipeStartX.current = null;
                  setDragX(0);
                }}
              >
                <div
                  key={`${periodUnit}-${bounds.start}`}
                  className="home-period-pager__page"
                  data-dragging={swipeStartX.current !== null || undefined}
                  data-motion={periodMotion}
                  style={{ '--period-drag': `${dragX}px` } as CSSProperties}
                >
                  {periodUnit === 'week' && (
                    <div className="week-days" aria-label={t('home.weekDays')}>
                      {days.map((day) => {
                        const dayWorkouts = periodWorkouts.filter(
                          (workout) => workout.date === day.iso,
                        );
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
                              const latest = [...dayWorkouts].sort(
                                (a, b) => b.startTs - a.startTs,
                              )[0];
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
                  )}
                  {periodUnit === 'month' && (
                    <div className="month-calendar" aria-label={t('home.monthCalendar')}>
                      {currentDays.map((day) => (
                        <span key={day.iso} className="month-calendar__weekday" aria-hidden>
                          {day.label}
                        </span>
                      ))}
                      {Array.from({ length: monthLeadingDays }, (_, index) => (
                        <span key={`blank-${index}`} aria-hidden />
                      ))}
                      {Array.from({ length: monthDayCount }, (_, index) => {
                        const iso = `${bounds.start.slice(0, 8)}${String(index + 1).padStart(2, '0')}`;
                        const dayWorkouts = periodWorkouts.filter(
                          (workout) => workout.date === iso,
                        );
                        const trained = dayWorkouts.length > 0;
                        const content = (
                          <>
                            <span>{index + 1}</span>
                            {trained && <i aria-hidden />}
                          </>
                        );
                        return trained ? (
                          <button
                            key={iso}
                            className="month-calendar__day month-calendar__day--trained"
                            aria-label={`${iso} ${t('home.trained')}`}
                            onClick={() => {
                              const latest = [...dayWorkouts].sort(
                                (a, b) => b.startTs - a.startTs,
                              )[0];
                              nav({ view: 'workoutDetail', id: latest.id });
                            }}
                          >
                            {content}
                          </button>
                        ) : (
                          <span key={iso} className="month-calendar__day">
                            {content}
                          </span>
                        );
                      })}
                      {Array.from({ length: monthTrailingDays }, (_, index) => (
                        <span key={`tail-${index}`} aria-hidden />
                      ))}
                    </div>
                  )}
                  {periodUnit === 'year' && (
                    <div className="home-year-pager display" aria-label={periodLabel}>
                      {bounds.start.slice(0, 4)}
                    </div>
                  )}
                </div>
              </div>
              <div
                key={`${periodUnit}-${bounds.start}-content`}
                className="home-period-content"
                data-motion={periodMotion}
              >
                <div className="week-metrics">
                  <div className="week-metric">
                    <div className="week-metric__value">
                      <strong className="display" aria-label={exact(summary.workouts)}>
                        {formatCompactNumber(summary.workouts, locale)}
                      </strong>
                      <span
                        className="week-metric__delta mono"
                        data-direction={deltas.workouts.direction}
                      >
                        {deltas.workouts.text}
                      </span>
                    </div>
                    <span>
                      {t('home.sessions', {
                        count: summary.workouts,
                      })}
                    </span>
                  </div>
                  <div className="week-metric">
                    <div className="week-metric__value">
                      <strong className="display" aria-label={exact(summary.workingSets)}>
                        {formatCompactNumber(summary.workingSets, locale)}
                      </strong>
                      <span
                        className="week-metric__delta mono"
                        data-direction={deltas.workingSets.direction}
                      >
                        {deltas.workingSets.text}
                      </span>
                    </div>
                    <span>{t('home.workingSets', { count: summary.workingSets })}</span>
                  </div>
                  <div className="week-metric week-metric--volume">
                    <div className="week-metric__value">
                      <strong
                        className="display"
                        aria-label={`${exact(displayVolume(summary.volume, unit))} ${unit}`}
                      >
                        {formatCompactNumber(displayVolume(summary.volume, unit), locale)} {unit}
                      </strong>
                      <span
                        className="week-metric__delta mono"
                        data-direction={deltas.volume.direction}
                      >
                        {deltas.volume.text}
                      </span>
                    </div>
                    <span>{t('home.volume')}</span>
                  </div>
                  <div className="week-metric week-metric--duration">
                    <div className="week-metric__value">
                      <strong className="display" aria-label={exact(summary.durationMin)}>
                        {formatCompactNumber(summary.durationMin, locale)}
                      </strong>
                      <span
                        className="week-metric__delta mono"
                        data-direction={deltas.durationMin.direction}
                      >
                        {deltas.durationMin.text}
                      </span>
                    </div>
                    <span>{t('home.duration')}</span>
                  </div>
                </div>
                <div className="home-chart-metrics" aria-label={t('home.chartMetric')}>
                  {(['workouts', 'workingSets', 'volume', 'durationMin'] as const).map((metric) => (
                    <button
                      key={metric}
                      type="button"
                      aria-pressed={chartMetric === metric}
                      onClick={() => setChartMetric(metric)}
                    >
                      {t(`home.metric.${metric}`)}
                    </button>
                  ))}
                </div>
                <LineChart
                  points={chartPoints}
                  height={150}
                  formatValue={chartValue}
                  label={t('home.chartLabel', {
                    metric: t(`home.metric.${chartMetric}`),
                    period: periodLabel,
                  })}
                />
              </div>
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
