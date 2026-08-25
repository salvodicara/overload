import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExportRows } from '../components/ExportRows';
import { IconBack } from '../components/Icons';
import { PageHeader } from '../components/PageHeader';
import { hevyAliasMap } from '../lib/exercises';
import { parseHevyCsv } from '../lib/hevyCsv';
import { parseBackup, planImport, type BackupV2 } from '../lib/importer';
import type { ExerciseNote, Routine, Workout } from '../lib/types';
import {
  BackupCloudSyncError,
  isAccountActionCurrent,
  isStaleAccountAction,
  STALE_ACCOUNT_ACTION,
  toast,
  useStore,
  type AccountActionResult,
  type Store,
} from '../state/useStore';

export type Preview = {
  name: string;
  fresh: Workout[];
  duplicates: number;
  unknown: string[];
  routines: Routine[];
  notes: ExerciseNote[];
  backup: BackupV2 | null;
};

export async function applyImportPreview(
  preview: Preview,
  actions: Pick<Store, 'restoreBackup' | 'saveRoutine' | 'importWorkouts' | 'importNotes'>,
): Promise<AccountActionResult<unknown>> {
  if (preview.backup) {
    const result = await actions.restoreBackup(preview.backup);
    return isAccountActionCurrent(result) ? result : STALE_ACCOUNT_ACTION;
  }
  let result: AccountActionResult<unknown>;
  for (const routine of preview.routines) {
    result = await actions.saveRoutine(routine);
    if (!isAccountActionCurrent(result)) return STALE_ACCOUNT_ACTION;
  }
  result = await actions.importWorkouts(preview.fresh);
  if (!isAccountActionCurrent(result)) return STALE_ACCOUNT_ACTION;
  if (preview.notes.length > 0) {
    result = await actions.importNotes(preview.notes);
    if (!isAccountActionCurrent(result)) return STALE_ACCOUNT_ACTION;
  }
  return result;
}

export async function confirmImportPreview(
  preview: Preview,
  actions: Pick<Store, 'restoreBackup' | 'saveRoutine' | 'importWorkouts' | 'importNotes'> & {
    onSuccess(freshCount: number): void;
  },
): Promise<AccountActionResult<unknown>> {
  const result = await applyImportPreview(preview, actions);
  if (isAccountActionCurrent(result)) actions.onSuccess(preview.fresh.length);
  else return STALE_ACCOUNT_ACTION;
  return result;
}

export function ImportExport() {
  const { t, i18n } = useTranslation();
  const workouts = useStore((state) => state.workouts);
  const nav = useStore((state) => state.nav);
  const importWorkouts = useStore((state) => state.importWorkouts);
  const restoreBackup = useStore((state) => state.restoreBackup);
  const importNotes = useStore((state) => state.importNotes);
  const saveRoutine = useStore((state) => state.saveRoutine);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const fileRequestRef = useRef(0);

  async function onFile(file: File): Promise<void> {
    const request = ++fileRequestRef.current;
    setPreview(null);
    setFileError(null);
    let readComplete = false;
    try {
      const text = await file.text();
      readComplete = true;
      if (request !== fileRequestRef.current) return;
      let incoming: Workout[];
      let unknown: string[] = [];
      let routines: Routine[] = [];
      let notes: ExerciseNote[] = [];
      let backup: BackupV2 | null = null;
      if (text.trimStart().startsWith('{')) {
        const parsed = parseBackup(text);
        incoming = parsed.workouts;
        routines = parsed.routines;
        if (parsed.version === 2) {
          backup = parsed;
          notes = parsed.notes;
        }
      } else {
        const parsed = parseHevyCsv(text, hevyAliasMap());
        incoming = parsed.workouts;
        unknown = parsed.unknownExercises;
        notes = parsed.notes;
      }
      if (!backup && incoming.length === 0 && routines.length === 0) {
        throw new Error('import.invalid');
      }
      const plan = backup
        ? { fresh: backup.workouts, duplicates: 0 }
        : planImport(new Set(workouts.map((workout) => workout.id)), incoming);
      setPreview({ name: file.name, ...plan, unknown, routines, notes, backup });
    } catch {
      if (request !== fileRequestRef.current) return;
      setPreview(null);
      if (readComplete) toast(t('import.invalid'));
      else setFileError(t('import.readFailed'));
    }
  }

  async function confirm(): Promise<void> {
    if (!preview || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    let stale = false;
    const completeBackup = preview.backup !== null;
    try {
      const result = await confirmImportPreview(preview, {
        restoreBackup,
        saveRoutine,
        importWorkouts,
        importNotes,
        onSuccess: (freshCount) => {
          setPreview(null);
          toast(completeBackup ? t('import.backupDone') : t('import.done', { count: freshCount }));
          nav({ view: 'home' });
        },
      });
      if (isStaleAccountAction(result)) {
        stale = true;
        return;
      }
    } catch (error) {
      toast(
        t(
          error instanceof BackupCloudSyncError
            ? 'import.localDoneCloudFailed'
            : 'import.restoreFailed',
        ),
      );
    } finally {
      if (!stale) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }

  const completeBackup = preview?.backup ?? null;
  const confirmLabel = busy
    ? t(completeBackup ? 'import.restoring' : 'import.importing')
    : t(completeBackup ? 'import.restore' : 'import.confirm');

  return (
    <div className="screen">
      <PageHeader
        title={t('import.title')}
        back={{ label: t('common.back'), icon: <IconBack />, onClick: () => history.back() }}
      />

      {workouts.length === 0 && (
        <div className="banner banner-good stack import-first-run">
          <strong>{t('import.firstRunTitle')}</strong>
          <span>{t('import.firstRunBody')}</span>
        </div>
      )}

      <div className="file-picker">
        <input
          className="visually-hidden"
          id="import-file"
          name="import-file"
          type="file"
          accept=".csv,.json"
          aria-label={t('import.pick')}
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void onFile(file);
          }}
        />
        <label
          className="btn btn-accent btn-block btn-big file-picker-trigger"
          htmlFor="import-file"
        >
          {t('import.pick')}
        </label>
      </div>
      <p className="small muted import-file-hint">{t('import.pickHint')}</p>
      {fileError && (
        <div className="banner banner-warn import-file-error" role="alert">
          {fileError}
        </div>
      )}

      {preview && (
        <section
          className="card import-preview"
          role="region"
          aria-label={t('import.previewRegion')}
          aria-busy={busy}
        >
          <p className="mono small muted import-preview__filename">{preview.name}</p>
          <h2 className="import-preview__title">
            {completeBackup ? t('import.completeBackup') : t('import.legacyPreview')}
          </h2>
          {completeBackup ? (
            <ul className="import-counts">
              {(
                [
                  ['folders', completeBackup.folders.length],
                  ['measurements', completeBackup.measurements.length],
                  ['nutrition', completeBackup.nutrition.length],
                  ['customExercises', completeBackup.customExercises.length],
                  ['notes', completeBackup.notes.length],
                  ['routines', completeBackup.routines.length],
                  ['workouts', completeBackup.workouts.length],
                  ['settings', 1],
                ] as const
              ).map(([key, count]) => {
                const label = t(`import.collections.${key}`);
                return (
                  <li key={key} aria-label={t('import.collectionCount', { label, count })}>
                    <span>{label}</span>
                    <strong className="mono">{count.toLocaleString(i18n.language)}</strong>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="stack">
              <strong>
                {t('import.preview', {
                  fresh: preview.fresh.length,
                  duplicates: preview.duplicates,
                })}
              </strong>
              {preview.unknown.length > 0 && (
                <span className="muted small">
                  {t('import.unknown', { count: preview.unknown.length })}
                </span>
              )}
              {preview.routines.length > 0 && (
                <span className="muted small">
                  {t('import.routines', { count: preview.routines.length })}
                </span>
              )}
              {preview.notes.length > 0 && (
                <span className="muted small">
                  {t('import.notes', { count: preview.notes.length })}
                </span>
              )}
            </div>
          )}
          <button
            className="btn btn-solid btn-block import-confirm"
            disabled={busy}
            onClick={() => void confirm()}
          >
            {confirmLabel}
          </button>
        </section>
      )}

      <section className="settings-section" aria-labelledby="export-title">
        <h2 className="settings-section__title" id="export-title">
          {t('import.export')}
        </h2>
        <div className="card settings-group">
          <ExportRows />
        </div>
      </section>
    </div>
  );
}
