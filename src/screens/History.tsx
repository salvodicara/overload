import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/PageHeader';
import { WorkoutList } from '../components/WorkoutList';
import { useStore } from '../state/useStore';

export function History() {
  const { t } = useTranslation();
  const workouts = useStore((state) => state.workouts);
  const nav = useStore((state) => state.nav);

  return (
    <div className="screen page history-screen">
      <PageHeader title={t('history.title')} />
      <section aria-labelledby="history-list">
        <h2 id="history-list" className="visually-hidden">
          {t('history.title')}
        </h2>
        {workouts.length > 0 ? (
          <WorkoutList
            workouts={workouts}
            onOpen={(workout) => nav({ view: 'workoutDetail', id: workout.id })}
          />
        ) : (
          <div className="empty">{t('history.empty')}</div>
        )}
      </section>
    </div>
  );
}
