import { useMemo, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { LineChart, type ChartPoint } from '../components/LineChart';
import { PageHeader } from '../components/PageHeader';
import { exerciseName, getCatalog } from '../lib/exercises';
import { displayVolume, displayWeight, weightLabel } from '../lib/units';
import { kindOf, trackingOf, type SetLog, type TrackingType, type Workout } from '../lib/types';
import { useStore } from '../state/useStore';
import { ProgressBody } from './ProgressBody';
import { ProgressDiet } from './ProgressDiet';

/** Monday of the ISO week containing `iso`, as YYYY-MM-DD. */
function isoWeekStart(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date.toLocaleDateString('sv');
}

function weeklyVolume(workouts: Workout[]): { week: string; volumeKg: number }[] {
  const totals = new Map<string, number>();
  for (const workout of workouts) {
    const week = isoWeekStart(workout.date);
    totals.set(week, (totals.get(week) ?? 0) + workout.volumeKg);
  }
  const weeks = [...totals.keys()].sort();
  if (weeks.length === 0) return [];

  const filled: { week: string; volumeKg: number }[] = [];
  const cursor = new Date(`${weeks[0]}T12:00:00`);
  const last = weeks[weeks.length - 1];
  for (let week = weeks[0]; week <= last;) {
    filled.push({ week, volumeKg: totals.get(week) ?? 0 });
    cursor.setDate(cursor.getDate() + 7);
    week = cursor.toLocaleDateString('sv');
  }
  return filled.slice(-12);
}

type SessionTop = {
  date: string;
  set: SetLog;
  value: number;
  isPr: boolean;
};

function valueOf(set: SetLog, tracking: TrackingType): number {
  if (tracking === 'duration') return set.durationSec ?? 0;
  if (tracking === 'reps') return set.reps;
  return set.weightKg;
}

function isBetter(set: SetLog, best: SetLog, tracking: TrackingType): boolean {
  const value = valueOf(set, tracking);
  const bestValue = valueOf(best, tracking);
  return (
    value > bestValue || (tracking === 'weight_reps' && value === bestValue && set.reps > best.reps)
  );
}

function topSets(
  workouts: Workout[],
  exerciseId: string,
): { tracking: TrackingType; sessions: SessionTop[] } | null {
  const ordered = [...workouts].sort(
    (left, right) => left.date.localeCompare(right.date) || left.startTs - right.startTs,
  );
  let current: TrackingType | null = null;
  for (const workout of ordered) {
    for (const set of workout.sets) {
      if (set.exerciseId === exerciseId && set.done && kindOf(set.kind) === 'working') {
        current = trackingOf(set.tracking);
      }
    }
  }
  if (!current) return null;

  const sessions: SessionTop[] = [];
  for (const workout of ordered) {
    const candidates = workout.sets.filter(
      (set) =>
        set.exerciseId === exerciseId &&
        set.done &&
        kindOf(set.kind) === 'working' &&
        trackingOf(set.tracking) === current,
    );
    if (candidates.length === 0) continue;
    const best = candidates.reduce((selected, set) =>
      isBetter(set, selected, current) ? set : selected,
    );
    sessions.push({
      date: workout.date,
      set: best,
      value: valueOf(best, current),
      isPr: current === 'weight_reps' && Boolean(best.isPr),
    });
  }
  return { tracking: current, sessions };
}

function TrainingSection() {
  const { t, i18n } = useTranslation();
  const { workouts, catalogReady, settings } = useStore();
  const [picked, setPicked] = useState<string | null>(null);
  const locale = i18n.language === 'it' ? 'it-IT' : 'en-GB';
  const unit = settings.unit ?? 'kg';

  const options = useMemo(() => {
    void catalogReady;
    const ids = new Set<string>();
    for (const workout of workouts) {
      for (const set of workout.sets) {
        if (set.done && kindOf(set.kind) === 'working') ids.add(set.exerciseId);
      }
    }
    return [...ids]
      .map((id) => ({ id, name: exerciseName(id, i18n.language), known: getCatalog().has(id) }))
      .sort(
        (left, right) =>
          Number(right.known) - Number(left.known) || left.name.localeCompare(right.name),
      );
  }, [workouts, catalogReady, i18n.language]);

  const selected =
    picked && options.some((option) => option.id === picked) ? picked : options[0]?.id;
  const progress = useMemo(
    () => (selected ? topSets(workouts, selected) : null),
    [workouts, selected],
  );
  const weeks = useMemo(() => weeklyVolume(workouts), [workouts]);

  if (!selected || !progress || progress.sessions.length === 0) {
    return <div className="progress-empty">{t('history.empty')}</div>;
  }

  const { tracking, sessions } = progress;
  const name = exerciseName(selected, i18n.language);
  const formatAxisValue = (value: number): string =>
    (tracking === 'weight_reps' ? displayWeight(value, unit) : value).toLocaleString(locale);
  const formatSession = (session: SessionTop): string => {
    if (tracking === 'duration') {
      return `${session.value.toLocaleString(locale)} ${t('workout.seconds')}`;
    }
    if (tracking === 'reps') {
      return `${session.value.toLocaleString(locale)} ${t('workout.reps')}`;
    }
    return `${displayWeight(session.set.weightKg, unit).toLocaleString(locale)} ${weightLabel(unit)} × ${session.set.reps.toLocaleString(locale)} ${t('workout.reps')}`;
  };
  const points: ChartPoint[] = sessions.map((session) => ({
    date: session.date,
    value: session.value,
    highlight: session.isPr,
  }));
  const best = sessions.reduce((selected, session) =>
    isBetter(session.set, selected.set, tracking) ? session : selected,
  );
  const last = sessions[sessions.length - 1];
  const caption = t(`progress.caption.${tracking}`);
  let pr: SessionTop | undefined;
  for (const session of sessions) {
    if (session.isPr) pr = session;
  }
  const chartLabel = t('progress.chartSummary', {
    exercise: name,
    caption,
    count: sessions.length,
    first: formatSession(sessions[0]),
    last: formatSession(last),
    pr: pr ? t('progress.prValue', { value: formatSession(pr) }) : '',
  });
  const fmtWeek = (iso: string): string =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
    });
  const formatWeeklyVolume = (volumeKg: number): string =>
    `${displayVolume(volumeKg, unit).toLocaleString(locale)} ${weightLabel(unit)}`;
  const maxWeek = Math.max(...weeks.map((week) => week.volumeKg), 1);

  return (
    <div className="progress-training">
      <label className="field-label" htmlFor="progress-exercise">
        {t('progress.pick')}
      </label>
      <select
        id="progress-exercise"
        name="exercise"
        autoComplete="off"
        value={selected}
        onChange={(event) => setPicked(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>

      <section className="progress-chart card card-pad" aria-labelledby="progress-chart-title">
        <h2 id="progress-chart-title" className="progress-section-title">
          {name}
        </h2>
        <LineChart points={points} label={chartLabel} formatValue={formatAxisValue} />
        <p className="small muted">{caption}</p>
      </section>

      <dl
        className="progress-metrics"
        role="group"
        aria-label={t('progress.summary', { exercise: name })}
      >
        {[
          [t('progress.best'), formatSession(best)],
          [t('progress.last'), formatSession(last)],
          [t('progress.sessions'), sessions.length.toLocaleString(locale)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <section className="progress-volume" aria-labelledby="progress-volume-title">
        <h2 id="progress-volume-title" className="progress-section-title">
          {t('progress.volumeWeek')}
        </h2>
        <div
          className="progress-volume__plot"
          role="img"
          aria-label={`${t('progress.volumeWeek')}: ${weeks
            .map((week) => `${fmtWeek(week.week)} ${formatWeeklyVolume(week.volumeKg)}`)
            .join(', ')}`}
        >
          {weeks.map((week) => (
            <span
              key={week.week}
              title={`${fmtWeek(week.week)} · ${formatWeeklyVolume(week.volumeKg)}`}
              style={{ height: `${Math.max(3, (week.volumeKg / maxWeek) * 100)}%` }}
            />
          ))}
        </div>
        <div className="spread mono small muted">
          <span>{weeks.length ? fmtWeek(weeks[0].week) : ''}</span>
          <span>{weeks.length ? formatWeeklyVolume(weeks[weeks.length - 1].volumeKg) : ''}</span>
        </div>
      </section>
    </div>
  );
}

const SEGMENTS = ['training', 'body', 'diet'] as const;
type Segment = (typeof SEGMENTS)[number];

export function Progress() {
  const { t } = useTranslation();
  const [segment, setSegment] = useState<Segment>('training');

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const current = SEGMENTS.indexOf(event.currentTarget.dataset.segment as Segment);
    let next = current;
    if (event.key === 'ArrowRight') next = (current + 1) % SEGMENTS.length;
    else if (event.key === 'ArrowLeft') next = (current - 1 + SEGMENTS.length) % SEGMENTS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = SEGMENTS.length - 1;
    else return;
    event.preventDefault();
    setSegment(SEGMENTS[next]);
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [next]?.focus();
  };

  return (
    <div className="screen progress-screen">
      <PageHeader title={t('progress.title')} />
      <div className="row seg progress-tabs" role="tablist" aria-label={t('progress.tabsLabel')}>
        {SEGMENTS.map((key) => (
          <button
            key={key}
            id={`progress-tab-${key}`}
            data-segment={key}
            role="tab"
            aria-selected={segment === key}
            aria-controls={`progress-panel-${key}`}
            tabIndex={segment === key ? 0 : -1}
            className={`seg-btn${segment === key ? ' on' : ''}`}
            onClick={() => setSegment(key)}
            onKeyDown={onTabKeyDown}
          >
            {t(`progress.seg.${key}`)}
          </button>
        ))}
      </div>
      {SEGMENTS.map((key) => (
        <section
          key={key}
          id={`progress-panel-${key}`}
          role="tabpanel"
          aria-labelledby={`progress-tab-${key}`}
          tabIndex={segment === key ? 0 : -1}
          hidden={segment !== key}
          className="progress-panel"
        >
          {segment === key && key === 'training' && <TrainingSection />}
          {segment === key && key === 'body' && <ProgressBody />}
          {segment === key && key === 'diet' && <ProgressDiet />}
        </section>
      ))}
    </div>
  );
}
