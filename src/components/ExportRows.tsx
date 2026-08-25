import { useTranslation } from 'react-i18next';
import { useCatalog } from '../hooks/useCatalog';
import { exerciseName } from '../lib/exercises';
import { toBackupJson, toCsv } from '../lib/exporter';
import { useStore } from '../state/useStore';

function download(filename: string, mime: string, data: string): void {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ExportRows() {
  const { t, i18n } = useTranslation();
  const workouts = useStore((state) => state.workouts);
  const routines = useStore((state) => state.routines);
  const folders = useStore((state) => state.folders);
  const notes = useStore((state) => state.notes);
  const measurements = useStore((state) => state.measurements);
  const nutrition = useStore((state) => state.nutrition);
  const customExercises = useStore((state) => state.customExercises);
  const settings = useStore((state) => state.settings);
  const catalogReady = useStore((state) => state.catalogReady);
  useCatalog(workouts.length > 0);

  return (
    <div className="export-rows">
      <button
        className="settings-row export-row"
        aria-label={t('settings.exportJson')}
        onClick={() =>
          download(
            'overload-backup.json',
            'application/json',
            toBackupJson({
              workouts,
              routines,
              folders,
              notes,
              measurements,
              nutrition,
              customExercises,
              settings,
            }),
          )
        }
      >
        <strong className="settings-row__copy">{t('settings.exportJson')}</strong>
        <span className="data-format mono" translate="no" aria-hidden="true">
          JSON
        </span>
      </button>
      <button
        className="settings-row export-row"
        aria-label={t('settings.exportCsv')}
        disabled={workouts.length > 0 && !catalogReady}
        onClick={() =>
          download(
            'overload-workouts.csv',
            'text/csv',
            toCsv(workouts, (id) => exerciseName(id, i18n.language)),
          )
        }
      >
        <strong className="settings-row__copy">{t('settings.exportCsv')}</strong>
        <span className="data-format mono" translate="no" aria-hidden="true">
          CSV
        </span>
      </button>
    </div>
  );
}
