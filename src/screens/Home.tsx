import { useTranslation } from 'react-i18next';
import { WorkoutList } from '../components/WorkoutList';
import { nextRoutine } from '../lib/routines';
import { kindOf, type Workout } from '../lib/types';
import { formatWeight } from '../lib/units';
import { computeVolume } from '../lib/volume';
import { useStore } from '../state/useStore';

type WeekDay = { iso: string; label: string };

function weekDays(now = new Date()): WeekDay[] {
  const monday = new Date(now);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return {
      iso: day.toLocaleDateString('sv'),
      label: day.toLocaleDateString(undefined, { weekday: 'narrow' }),
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
  const days = weekDays();
  const daySet = new Set(days.map((day) => day.iso));
  const weeklyWorkouts = workouts.filter((workout) => daySet.has(workout.date) && workingSetCount(workout) > 0);
  const workingSets = weeklyWorkouts.reduce((total, workout) => total + workingSetCount(workout), 0);
  const weeklyVolume = weeklyWorkouts.reduce((total, workout) => total + computeVolume(workout.sets), 0);
  const next = nextRoutine(routines, folders, workouts);
  const today = new Date().toLocaleDateString('sv');
  const unit = settings.unit ?? 'kg';

  return (
    <main className="screen">
      <header style={{ padding: '22px 0 14px' }}>
        <h1 className="display" style={{ fontSize: 30 }}>{t('app.name')}</h1>
      </header>

      {active && (
        <section aria-labelledby="resume-workout" style={{ marginBottom: 14 }}>
          <div className="card card-pad stack">
            <h2 id="resume-workout" style={{ fontSize: 18 }}>{t('home.resume')}</h2>
            <button className="btn btn-accent btn-block" onClick={() => nav({ view: 'workout' })}>
              {t('activeBar.resume')}
            </button>
          </div>
        </section>
      )}

      <section aria-labelledby="next-workout">
        <div className="card card-pad stack">
          <div>
            <span className="mono small muted" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {t('home.upNext')}
            </span>
            <h2 id="next-workout" style={{ fontSize: 21, marginTop: 3 }}>{t('home.nextWorkout')}</h2>
          </div>
          {next ? (
            <>
              <div>
                <strong style={{ fontSize: 18 }}>{next.name}</strong>
                <div className="small muted" style={{ marginTop: 3 }}>
                  {t('home.exercises', { n: next.exercises.length })}
                </div>
              </div>
              {!active && (
                <button className="btn btn-accent btn-block" onClick={() => startWorkout(next.id)}>
                  {t('home.start')}
                </button>
              )}
            </>
          ) : (
            <>
              <p className="muted small">{t('home.welcomeBody')}</p>
              <button className="btn btn-accent btn-block" onClick={() => nav({ view: 'train' })}>
                {t('home.welcomeCta')}
              </button>
            </>
          )}
        </div>
      </section>

      <section aria-labelledby="week-summary" style={{ marginTop: 20 }}>
        <h2 id="week-summary" className="display" style={{ fontSize: 20, marginBottom: 8 }}>{t('home.thisWeek')}</h2>
        <div className="card card-pad stack">
          <div className="spread" aria-label={t('home.weekDays')}>
            {days.map((day) => {
              const trained = weeklyWorkouts.some((workout) => workout.date === day.iso);
              return (
                <span
                  key={day.iso}
                  className={`chip${trained ? ' chip-accent' : ''}`}
                  aria-label={`${day.iso}${trained ? ` ${t('home.trained')}` : ''}`}
                  aria-current={day.iso === today ? 'date' : undefined}
                  style={{ minWidth: 25, textAlign: 'center' }}
                >
                  {day.label}
                </span>
              );
            })}
          </div>
          <div className="row" style={{ alignItems: 'start', justifyContent: 'space-between', gap: 10 }}>
            <span>
              <strong className="display" style={{ fontSize: 25 }}>{weeklyWorkouts.length}</strong>
              <span className="small muted"> {t('home.sessions')}</span>
            </span>
            <span>
              <strong className="display" style={{ fontSize: 25 }}>{workingSets}</strong>
              <span className="small muted"> {t('home.workingSets')}</span>
            </span>
            <span style={{ textAlign: 'right' }}>
              <strong className="display" style={{ fontSize: 25 }}>{formatWeight(weeklyVolume, unit, i18n.language)}</strong>
              <span className="small muted"> {t('home.volume')}</span>
            </span>
          </div>
        </div>
      </section>

      <section aria-labelledby="recent-workouts" style={{ marginTop: 20 }}>
        <div className="spread" style={{ marginBottom: 8 }}>
          <h2 id="recent-workouts" className="display" style={{ fontSize: 20 }}>{t('home.recent')}</h2>
          <button className="btn btn-ghost" style={{ minHeight: 40, padding: '8px 12px' }} onClick={() => nav({ view: 'history' })}>
            {t('home.allHistory')}
          </button>
        </div>
        {workouts.length > 0 ? (
          <WorkoutList workouts={workouts} limit={3} onOpen={(workout) => nav({ view: 'workoutDetail', id: workout.id })} />
        ) : (
          <p className="muted small">{t('history.empty')}</p>
        )}
      </section>
    </main>
  );
}
