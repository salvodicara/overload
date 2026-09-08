import { useTranslation } from 'react-i18next';
import { IconBack } from '../components/Icons';
import { PageHeader } from '../components/PageHeader';
import { ProgressBody } from './ProgressBody';
import { FoodDiary } from './FoodDiary';

export function PersonalMetrics({ kind }: { kind: 'body' | 'diet' }) {
  const { t } = useTranslation();
  return (
    <div className={`screen progress-screen ${kind}-screen`}>
      <PageHeader
        className="detail-page-header"
        title={t(kind === 'body' ? 'profile.measurements' : 'progress.seg.diet')}
        back={{ label: t('common.back'), icon: <IconBack />, onClick: () => history.back() }}
      />
      <div className="progress-panel">{kind === 'body' ? <ProgressBody /> : <FoodDiary />}</div>
    </div>
  );
}
