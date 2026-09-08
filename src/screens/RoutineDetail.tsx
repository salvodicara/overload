import { RoutinePrescription } from '../components/RoutinePrescription';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/PageHeader';
import { IconBack } from '../components/Icons';
import { useCatalog } from '../hooks/useCatalog';
import { useStore } from '../state/useStore';
import '../theme/routine-detail.css';

export function RoutineDetail({ id }: { id: string }) {
  const { t } = useTranslation();
  useCatalog();
  const { routines, active, nav, startWorkout } = useStore();
  const routine = routines.find((item) => item.id === id);
  if (!routine)
    return (
      <div className="screen">
        <button className="btn" onClick={() => history.back()}>
          {t('common.back')}
        </button>
      </div>
    );
  return (
    <div className="screen routine-preview">
      <PageHeader
        className="detail-page-header"
        title={routine.name}
        back={{ label: t('common.back'), icon: <IconBack />, onClick: () => history.back() }}
        action={
          <button className="btn btn-ghost" onClick={() => nav({ view: 'routineEditor', id })}>
            {t('routines.editAction')}
          </button>
        }
      />
      <p className="muted">{t('home.exercises', { count: routine.exercises.length })}</p>
      <button
        className="btn btn-accent btn-block btn-big"
        disabled={!active && routine.exercises.length === 0}
        onClick={() => (active ? nav({ view: 'workout' }) : startWorkout(id))}
      >
        {t(active ? 'home.resume' : 'home.start')}
      </button>
      <RoutinePrescription
        routine={routine}
        onExercise={(exerciseId) => nav({ view: 'exercise', id: exerciseId, from: 'routine' })}
      />
    </div>
  );
}
