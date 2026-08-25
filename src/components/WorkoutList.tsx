import { useTranslation } from 'react-i18next';
import { exerciseName } from '../lib/exercises';
import { fmtDate } from '../lib/format';
import { kindOf, type Workout } from '../lib/types';
import { displayVolume } from '../lib/units';
import { useStore } from '../state/useStore';

type WorkoutListProps = {
  workouts: Workout[];
  limit?: number;
  onOpen: (workout: Workout) => void;
};

function exerciseLines(workout: Workout, locale: string): { label: string; extra: number } {
  const counts = new Map<string, number>();
  for (const set of workout.sets) {
    if (!set.done || kindOf(set.kind) !== 'working') continue;
    counts.set(set.exerciseId, (counts.get(set.exerciseId) ?? 0) + 1);
  }
  const entries = [...counts.entries()];
  const shown = entries.slice(0, 4);
  return {
    label: shown.map(([id, count]) => `${count} × ${exerciseName(id, locale)}`).join('\n'),
    extra: entries.length - shown.length,
  };
}

const newestFirst = (left: Workout, right: Workout): number =>
  right.startTs - left.startTs ||
  right.updatedAt - left.updatedAt ||
  right.id.localeCompare(left.id);

type WorkoutMonth = {
  key: string;
  label: string;
  workouts: Workout[];
};

export function WorkoutList({ workouts, limit, onOpen }: WorkoutListProps) {
  const { t, i18n } = useTranslation();
  const unit = useStore((state) => state.settings.unit ?? 'kg');
  const visible = [...workouts].sort(newestFirst).slice(0, limit);
  const locale = i18n.language === 'it' ? 'it-IT' : 'en-GB';
  const months = visible.reduce<WorkoutMonth[]>((groups, workout) => {
    const key = workout.date.slice(0, 7);
    const current = groups.at(-1);
    if (current?.key === key) {
      current.workouts.push(workout);
      return groups;
    }
    groups.push({
      key,
      label: new Date(`${workout.date}T12:00:00`).toLocaleDateString(locale, {
        month: 'long',
        year: 'numeric',
      }),
      workouts: [workout],
    });
    return groups;
  }, []);

  return (
    <div className="workout-groups">
      {months.map((month) => {
        const headingId = `workout-month-${month.key}`;
        return (
          <section key={month.key} className="workout-group" aria-labelledby={headingId}>
            <h3 id={headingId} className="mono workout-group__title">
              {month.label}
            </h3>
            <ul className="workout-group__list">
              {month.workouts.map((workout) => {
                const minutes = workout.endTs
                  ? Math.max(1, Math.round((workout.endTs - workout.startTs) / 60_000))
                  : null;
                const hasPr = workout.sets.some((set) => set.isPr);
                const workingSets = workout.sets.filter(
                  (set) => set.done && kindOf(set.kind) === 'working',
                ).length;
                const lines = exerciseLines(workout, i18n.language);
                return (
                  <li key={workout.id}>
                    <button className="workout-row" onClick={() => onOpen(workout)}>
                      <span className="workout-row__heading">
                        <strong>{workout.dayLabel ?? t('nav.workout')}</strong>
                        <time className="mono" dateTime={workout.date}>
                          {fmtDate(workout.date, i18n.language, {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })}
                        </time>
                      </span>
                      <span className="workout-row__metrics mono">
                        {minutes !== null && <span>{t('summary.duration', { min: minutes })}</span>}
                        <span>
                          {displayVolume(workout.volumeKg, unit).toLocaleString(locale)} {unit}
                        </span>
                        <span>{t('history.workingSetCount', { count: workingSets })}</span>
                        {hasPr && <span className="workout-row__positive">{t('history.pr')}</span>}
                        {workout.source !== 'app' && <span>{t('history.imported')}</span>}
                      </span>
                      {lines.label && (
                        <span className="workout-row__exercises">
                          {lines.label}
                          {lines.extra > 0 &&
                            `\n${t('home.moreExercises', { count: lines.extra })}`}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
