import { IconBack } from '../components/Icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { exerciseName, hevyAliasMap } from '../lib/exercises';
import { toBackupJson, toCsv } from '../lib/exporter';
import { parseBackup, planImport } from '../lib/importer';
import { parseHevyCsv } from '../lib/hevyCsv';
import { toast, useStore } from '../state/useStore';
import type { ExerciseNote, Routine, Workout } from '../lib/types';

function download(filename: string, mime: string, data: string): void {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** JSON + CSV download rows, shared with the Settings screen (both live inside a `.card`). */
export function ExportRows() {
  const { t, i18n } = useTranslation();
  const workouts = useStore((s) => s.workouts);
  const routines = useStore((s) => s.routines);
  const settings = useStore((s) => s.settings);
  const divider = { borderTop: '1px solid var(--line)' };

  return (
    <>
      <button
        className="card-pad spread"
        style={{ width: '100%', textAlign: 'left' }}
        onClick={() =>
          download(
            'overload-backup.json',
            'application/json',
            toBackupJson(workouts, routines, settings),
          )
        }
      >
        <span>{t('settings.exportJson')}</span>
        <span className="chip">JSON</span>
      </button>
      <button
        className="card-pad spread"
        style={{ ...divider, width: '100%', textAlign: 'left' }}
        onClick={() =>
          download(
            'overload-workouts.csv',
            'text/csv',
            toCsv(workouts, (id) => exerciseName(id, i18n.language)),
          )
        }
      >
        <span>{t('settings.exportCsv')}</span>
        <span className="chip">CSV</span>
      </button>
    </>
  );
}

type Preview = {
  name: string;
  fresh: Workout[];
  duplicates: number;
  unknown: string[];
  routines: Routine[];
  notes: ExerciseNote[];
};

export function ImportExport() {
  const { t } = useTranslation();
  const workouts = useStore((s) => s.workouts);
  const nav = useStore((s) => s.nav);
  const importWorkouts = useStore((s) => s.importWorkouts);
  const importNotes = useStore((s) => s.importNotes);
  const saveRoutine = useStore((s) => s.saveRoutine);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File): Promise<void> {
    const text = await file.text();
    try {
      let incoming: Workout[];
      let unknown: string[] = [];
      let routines: Routine[] = [];
      let notes: ExerciseNote[] = [];
      if (text.trimStart().startsWith('{')) {
        const backup = parseBackup(text);
        incoming = backup.workouts;
        routines = backup.routines;
      } else {
        const parsed = parseHevyCsv(text, hevyAliasMap());
        incoming = parsed.workouts;
        unknown = parsed.unknownExercises;
        notes = parsed.notes;
      }
      if (incoming.length === 0 && routines.length === 0) throw new Error('import.invalid');
      const plan = planImport(new Set(workouts.map((w) => w.id)), incoming);
      setPreview({ name: file.name, ...plan, unknown, routines, notes });
    } catch {
      setPreview(null);
      toast(t('import.invalid'));
    }
  }

  async function confirm(): Promise<void> {
    if (!preview) return;
    setBusy(true);
    for (const routine of preview.routines) await saveRoutine(routine);
    await importWorkouts(preview.fresh);
    if (preview.notes.length > 0) await importNotes(preview.notes);
    setBusy(false);
    setPreview(null);
    toast(t('import.done', { n: preview.fresh.length }));
    nav({ view: 'home' });
  }

  return (
    <div className="screen">
      <div className="row" style={{ padding: '18px 0 6px' }}>
        <button
          className="iconbtn"
          aria-label={t('common.back')}
          onClick={() => nav({ view: 'profile' })}
        >
          <IconBack />
        </button>
        <div className="display" style={{ fontSize: 26 }}>
          {t('import.title')}
        </div>
      </div>

      {workouts.length === 0 && (
        <div className="banner banner-good stack" style={{ marginTop: 12 }}>
          <strong>{t('import.firstRunTitle')}</strong>
          <span>{t('import.firstRunBody')}</span>
        </div>
      )}

      <label className="btn btn-accent btn-block btn-big" style={{ marginTop: 14 }}>
        <input
          type="file"
          accept=".csv,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void onFile(file);
          }}
        />
        {t('import.pick')}
      </label>
      <div className="small muted" style={{ marginTop: 8, textAlign: 'center' }}>
        {t('import.pickHint')}
      </div>

      {preview && (
        <div className="card card-pad stack" style={{ marginTop: 16 }}>
          <div className="mono small muted">{preview.name}</div>
          <strong>
            {t('import.preview', { fresh: preview.fresh.length, dup: preview.duplicates })}{preview.notes.length > 0 ? ` · ${t('import.notes', { n: preview.notes.length })}` : ''}
          </strong>
          {preview.unknown.length > 0 && (
            <span className="muted small">
              {t('import.unknown', { n: preview.unknown.length })}
            </span>
          )}
          {preview.routines.length > 0 && (
            <span className="muted small">
              {t('import.routines', { n: preview.routines.length })}
            </span>
          )}
          <button
            className="btn btn-solid btn-block"
            disabled={busy}
            onClick={() => void confirm()}
          >
            {t('import.confirm')}
          </button>
        </div>
      )}

      <div
        className="mono small muted"
        style={{ textTransform: 'uppercase', letterSpacing: '0.1em', margin: '24px 0 8px' }}
      >
        {t('import.export')}
      </div>
      <div className="card">
      </div>
    </div>
  );
}
