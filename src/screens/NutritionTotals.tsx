import { useTranslation } from 'react-i18next';
import { IconBack } from '../components/Icons';
import { PageHeader } from '../components/PageHeader';
import { ProgressDiet } from './ProgressDiet';
export function NutritionTotals({ date }: { date: string }) {
  const { t } = useTranslation();
  return (
    <div className="screen">
      <PageHeader
        className="detail-page-header"
        title={t('food.manualTotals')}
        back={{ label: t('common.back'), icon: <IconBack />, onClick: () => history.back() }}
      />
      <p className="small muted">{t('food.manualHint')}</p>
      <ProgressDiet initialDate={date} />
    </div>
  );
}
