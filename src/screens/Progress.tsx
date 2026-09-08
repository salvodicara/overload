import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LineChart, type ChartPoint } from '../components/LineChart';
import { TrainingOverview } from '../components/TrainingOverview';
import { PageHeader } from '../components/PageHeader';
import { useCatalog } from '../hooks/useCatalog';
import { useSurfaceState } from '../hooks/useSurfaceState';
import { exerciseName, getCatalog } from '../lib/exercises';
import { formatWeight } from '../lib/units';
import { kindOf, trackingOf, type SetLog, type TrackingType, type Workout } from '../lib/types';
import { useStore } from '../state/useStore';
import { IconBack } from '../components/Icons';

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

function TrainingSection({
  picked,
  requested,
  onPick,
}: {
  picked: string | null;
  requested?: string;
  onPick(id: string): void;
}) {
  const { t, i18n } = useTranslation();
  const { workouts, catalogReady, settings } = useStore();
  useCatalog(workouts.length > 0);
  const locale = i18n.language === 'it' ? 'it-IT' : 'en-GB';
  const unit = settings.unit ?? 'kg';

  const options = useMemo(() => {
    void catalogReady;
    const ids = new Set<string>();
    if (requested) ids.add(requested);
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
  }, [workouts, catalogReady, i18n.language, requested]);

  const selected =
    picked && options.some((option) => option.id === picked) ? picked : options[0]?.id;
  const progress = useMemo(
    () => (selected ? topSets(workouts, selected) : null),
    [workouts, selected],
  );

  if (!selected) {
    return <div className="progress-empty">{t('history.empty')}</div>;
  }

  const { tracking, sessions } = progress ?? { tracking: 'weight_reps' as const, sessions: [] };
  const name = exerciseName(selected, i18n.language);
  const picker = (
    <>
      <label className="field-label" htmlFor="progress-exercise">
        {t('progress.pick')}
      </label>
      <select
        id="progress-exercise"
        name="exercise"
        autoComplete="off"
        value={selected}
        onChange={(event) => onPick(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </>
  );
  if (sessions.length === 0)
    return (
      <div className="progress-training">
        {picker}
        <section className="progress-chart card card-pad" aria-labelledby="progress-chart-title">
          <h2 id="progress-chart-title" className="progress-section-title">
            {name}
          </h2>
          <p className="progress-state" role="status">
            {t('progress.noExerciseHistory')}
          </p>
        </section>
      </div>
    );
  const formatAxisValue = (value: number): string =>
    tracking === 'weight_reps'
      ? formatWeight(value, unit, i18n.language)
      : value.toLocaleString(locale);
  const formatSession = (session: SessionTop): string => {
    if (tracking === 'duration') {
      return `${session.value.toLocaleString(locale)} ${t('workout.seconds')}`;
    }
    if (tracking === 'reps') {
      return `${session.value.toLocaleString(locale)} ${t('workout.reps')}`;
    }
    return `${formatWeight(session.set.weightKg, unit, i18n.language)} × ${session.set.reps.toLocaleString(locale)}`;
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
  return (
    <div className="progress-training">
      {picker}

      <section className="progress-chart card card-pad" aria-labelledby="progress-chart-title">
        <h2 id="progress-chart-title" className="progress-section-title">
          {name}
        </h2>
        {points.length > 1 ? (
          <LineChart points={points} label={chartLabel} formatValue={formatAxisValue} />
        ) : (
          <div className="progress-state progress-single-session" role="status">
            <strong className="mono">{formatSession(last)}</strong>
            <span>{t('progress.needAnotherSession')}</span>
          </div>
        )}
        <p className="small muted">{caption}</p>
        {pr && (
          <p className="small mono">
            {t('progress.latestPr')} · {formatSession(pr)}
          </p>
        )}
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
    </div>
  );
}

export function Progress() {
  const { t } = useTranslation();
  const route = useStore((state) => state.route);
  const initialExerciseId = route.view === 'progress' ? route.exerciseId : undefined;
  const [surface, setSurface] = useSurfaceState('progress', { exerciseId: initialExerciseId });
  return (
    <div className="screen progress-screen">
      <PageHeader
        className="detail-page-header"
        title={t('profile.statistics')}
        back={{ label: t('common.back'), icon: <IconBack />, onClick: () => history.back() }}
      />
      <section className="progress-panel" aria-label={t('profile.statistics')}>
        {!initialExerciseId && (
          <TrainingOverview
            surface={surface}
            onChange={(patch) => setSurface((current) => ({ ...current, ...patch }))}
          />
        )}
        <TrainingSection
          requested={initialExerciseId}
          picked={surface.exerciseId ?? initialExerciseId ?? null}
          onPick={(exerciseId) => setSurface((current) => ({ ...current, exerciseId }))}
        />
      </section>
    </div>
  );
}
