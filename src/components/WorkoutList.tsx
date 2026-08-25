import { useTranslation } from 'react-i18next';
import { exerciseName } from '../lib/exercises';
import { fmtDate } from '../lib/format';
import { formatWeight } from '../lib/units';
import { useStore } from '../state/useStore';
import type { Workout } from '../lib/types';

type WorkoutListProps = {
  workouts: Workout[];
  limit?: number;
  onOpen: (workout: Workout) => void;
};

/** Hevy-style exercise summary: "3 × Dumbbell bench press" per exercise. */
function exerciseLines(workout: Workout, locale: string): { label: string; extra: number } {
  const counts = new Map<string, number>();
  for (const set of workout.sets) counts.set(set.exerciseId, (counts.get(set.exerciseId) ?? 0) + 1);
  const entries = [...counts.entries()];
  const shown = entries.slice(0, 4);
  return {
    label: shown.map(([id, count]) => `${count} × ${exerciseName(id, locale)}`).join('\n'),
    extra: entries.length - shown.length,
  };
}

const newestFirst = (left: Workout, right: Workout): number =>
  right.startTs - left.startTs || right.updatedAt - left.updatedAt || right.id.localeCompare(left.id);

export function WorkoutList({ workouts, limit, onOpen }: WorkoutListProps) {
  const { t, i18n } = useTranslation();
  const unit = useStore((state) => state.settings.unit ?? 'kg');
  const visible = [...workouts].sort(newestFirst).slice(0, limit);
  let lastMonth = '';

  return (
    <div className="stack">
      {visible.map((workout) => {
        const month = new Date(`${workout.date}T12:00:00`).toLocaleDateString(
          i18n.language === 'it' ? 'it-IT' : 'en-GB',
          { month: 'long', year: 'numeric' },
        );
        const header =
          month !== lastMonth ? (
            <div
              key={`month-${month}`}
              className="mono small muted"
              style={{ letterSpacing: '0.1em', textTransform: 'uppercase', margin: '14px 0 2px' }}
            >
              {month}
            </div>
          ) : null;
        lastMonth = month;
        const minutes = workout.endTs ? Math.max(1, Math.round((workout.endTs - workout.startTs) / 60_000)) : null;
        const hasPr = workout.sets.some((set) => set.isPr);
        const lines = exerciseLines(workout, i18n.language);
        return (
          <div key={workout.id} style={{ display: 'contents' }}>
            {header}
            <button
              className="card card-pad stack"
              style={{ width: '100%', textAlign: 'left', gap: 8 }}
              onClick={() => onOpen(workout)}
            >
              <div className="spread">
                <span style={{ fontWeight: 700, fontSize: 16 }}>{workout.dayLabel ?? t('nav.workout')}</span>
                <span className="mono small muted">
                  {fmtDate(workout.date, i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
              </div>
              <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                {minutes !== null && <span className="chip">{t('summary.duration', { min: minutes })}</span>}
                <span className="chip mono">{formatWeight(workout.volumeKg, unit, i18n.language)}</span>
                <span className="chip">{t('history.sets', { n: workout.sets.length })}</span>
                {hasPr && <span className="chip chip-good">{t('history.pr')}</span>}
                {workout.source !== 'app' && <span className="chip">{t('history.imported')}</span>}
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
  );
}
