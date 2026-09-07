import { useTranslation } from 'react-i18next';
import { IconBack, IconForward } from './Icons';
import { LineChart } from './LineChart';
import { formatCompactNumber } from '../lib/format';
import type { HomeSurfaceState } from '../lib/navigationState';
import {
  periodBounds,
  periodBuckets,
  periodSummary,
  shiftPeriod,
  weekDays,
  weekRangeLabel,
} from '../lib/trainingPeriods';
import { kindOf } from '../lib/types';
import { displayVolume } from '../lib/units';
import { useStore } from '../state/useStore';
import '../theme/overview.css';

type OverviewState = Pick<HomeSurfaceState, 'periodUnit' | 'periodAnchor' | 'chartMetric'>;

export function TrainingOverview({
  surface,
  onChange,
}: {
  surface: OverviewState;
  onChange(patch: OverviewState): void;
}) {
  const { t, i18n } = useTranslation();
  const { workouts, settings } = useStore();
  const now = new Date();
  const todayAnchor = now.toLocaleDateString('sv');
  const periodUnit = surface.periodUnit ?? 'week';
  const chartMetric = surface.chartMetric ?? 'volume';
  const periodAnchor = new Date(`${surface.periodAnchor ?? todayAnchor}T12:00:00`);
  const bounds = periodBounds(periodAnchor, periodUnit);
  const currentBounds = periodBounds(now, periodUnit);
  const earliestDate = workouts.reduce(
    (earliest, workout) =>
      workout.sets.some((set) => set.done && kindOf(set.kind) === 'working') &&
      workout.date < earliest
        ? workout.date
        : earliest,
    todayAnchor,
  );
  const earliestBounds = periodBounds(new Date(`${earliestDate}T12:00:00`), periodUnit);
  const isCurrentPeriod = bounds.start >= currentBounds.start;
  const isEarliestPeriod = bounds.start <= earliestBounds.start;
  const summary = periodSummary(periodAnchor, periodUnit, workouts, now);
  const buckets = periodBuckets(periodAnchor, periodUnit, workouts, now);
  const unit = settings.unit ?? 'kg';
  const locale = i18n.language.startsWith('it') ? 'it-IT' : 'en-GB';
  const periodLabel =
    periodUnit === 'week'
      ? weekRangeLabel(weekDays(periodAnchor, i18n.language), i18n.language)
      : periodUnit === 'month'
        ? new Date(`${bounds.start}T12:00:00`).toLocaleDateString(locale, {
            month: 'long',
            year: 'numeric',
          })
        : bounds.start.slice(0, 4);
  const metricDelta = (
    current: number,
    previous: number,
    format: 'absolute' | 'percentage' = 'absolute',
  ) => {
    const difference = current - previous;
    const direction = difference > 0 ? 'increase' : difference < 0 ? 'decrease' : 'neutral';
    if (difference === 0) return { direction, text: '—' };
    if (format === 'percentage' && previous === 0) return { direction, text: t('home.new') };
    const value = format === 'percentage' ? (difference / previous) * 100 : difference;
    return {
      direction,
      text: `${difference > 0 ? '+' : '−'}${formatCompactNumber(Math.abs(value), locale)}${format === 'percentage' ? '%' : ''}`,
    };
  };
  const deltas = {
    workouts: metricDelta(summary.workouts, summary.previous.workouts),
    workingSets: metricDelta(summary.workingSets, summary.previous.workingSets),
    volume: metricDelta(summary.volume, summary.previous.volume, 'percentage'),
    durationMin: metricDelta(summary.durationMin, summary.previous.durationMin),
  };
  const exact = (value: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  const chartPoints = buckets.map((bucket) => ({
    date: bucket.date,
    value: chartMetric === 'volume' ? displayVolume(bucket.volume, unit) : bucket[chartMetric],
  }));
  const chartValue = (value: number) =>
    `${formatCompactNumber(value, locale)}${chartMetric === 'volume' ? ` ${unit}` : chartMetric === 'durationMin' ? ' min' : ''}`;
  function movePeriod(amount: -1 | 1) {
    if ((amount < 0 && isEarliestPeriod) || (amount > 0 && isCurrentPeriod)) return;
    onChange({
      periodAnchor: shiftPeriod(periodAnchor, periodUnit, amount).toLocaleDateString('sv'),
    });
  }
  return (
    <section className="training-overview" aria-labelledby="training-overview-title">
      <h2 id="training-overview-title" className="progress-section-title">
        {t('progress.overview')}
      </h2>
      <div
        className="home-period-tabs overview-period-controls"
        role="group"
        aria-label={t('home.trainingPeriod')}
      >
        {(['week', 'month', 'year'] as const).map((unitName) => (
          <button
            key={unitName}
            type="button"
            aria-pressed={periodUnit === unitName}
            onClick={() => onChange({ periodUnit: unitName, periodAnchor: todayAnchor })}
          >
            {t(`home.${unitName}`)}
          </button>
        ))}
      </div>
      <div
        className="overview-period-navigation"
        role="group"
        aria-label={t('home.periodNavigation')}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          movePeriod(event.key === 'ArrowLeft' ? -1 : 1);
        }}
      >
        <button
          type="button"
          className="overview-previous"
          disabled={isEarliestPeriod}
          aria-label={t('progress.previousPeriod')}
          onClick={() => movePeriod(-1)}
        >
          <IconBack />
        </button>
        <span className="home-period-label mono" aria-live="polite">
          {periodLabel}
        </span>
        <button
          type="button"
          className="overview-next"
          disabled={isCurrentPeriod}
          aria-label={t('progress.nextPeriod')}
          onClick={() => movePeriod(1)}
        >
          <IconForward />
        </button>
      </div>
      <div className="overview-current-slot">
        {!isCurrentPeriod && (
          <button
            type="button"
            className="overview-current home-period-today"
            onClick={() => onChange({ periodAnchor: todayAnchor })}
          >
            {t('home.today')}
          </button>
        )}
      </div>
      <div className="week-metrics">
        <div className="week-metric">
          <div className="week-metric__value">
            <strong className="display" aria-label={exact(summary.workouts)}>
              {formatCompactNumber(summary.workouts, locale)}
            </strong>
            <span className="week-metric__delta mono" data-direction={deltas.workouts.direction}>
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
            <span className="week-metric__delta mono" data-direction={deltas.workingSets.direction}>
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
            <span className="week-metric__delta mono" data-direction={deltas.volume.direction}>
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
            <span className="week-metric__delta mono" data-direction={deltas.durationMin.direction}>
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
            onClick={() => onChange({ chartMetric: metric })}
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
    </section>
  );
}
