import { useTranslation } from 'react-i18next';
import { WorkoutList } from '../components/WorkoutList';
import { useStore } from '../state/useStore';

export function History() {
  const { t } = useTranslation();
  const workouts = useStore((state) => state.workouts);
  const nav = useStore((state) => state.nav);

  return (
    <main className="screen">
      <header style={{ padding: '22px 0 14px' }}>
        <h1 className="display" style={{ fontSize: 30 }}>{t('history.title')}</h1>
      </header>
      <section aria-labelledby="history-list">
        <h2 id="history-list" className="small muted" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>
          {t('history.title')}
        </h2>
        {workouts.length > 0 ? (
          <WorkoutList workouts={workouts} onOpen={(workout) => nav({ view: 'workoutDetail', id: workout.id })} />
        ) : (
          <div className="empty">{t('history.empty')}</div>
        )}
      </section>
    </main>
  );
}
