import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconForward } from '../components/Icons';
import { TEMPLATES } from '../data/templates';
import { fmtDate } from '../lib/format';
import { lastCompletedFor, nextRoutine } from '../lib/routines';
import {
  isAccountActionCurrent,
  STALE_ACCOUNT_ACTION,
  useStore,
  type AccountActionResult,
  type Store,
} from '../state/useStore';
import type { Folder, Routine } from '../lib/types';
import { MomentumCard } from '../components/MomentumCard';

export async function installTemplatePack(
  pack: (typeof TEMPLATES)[number],
  actions: Pick<Store, 'saveFolder' | 'saveRoutine'>,
): Promise<AccountActionResult> {
  let result = await actions.saveFolder(structuredClone(pack.folder));
  if (!isAccountActionCurrent(result)) return STALE_ACCOUNT_ACTION;
  for (const routine of pack.routines) {
    result = await actions.saveRoutine(structuredClone(routine));
    if (!isAccountActionCurrent(result)) return STALE_ACCOUNT_ACTION;
  }
  return result;
}

function RoutineCard({ routine, suggested }: { routine: Routine; suggested?: boolean }) {
  const { t, i18n } = useTranslation();
  const nav = useStore((s) => s.nav);
  const startWorkout = useStore((s) => s.startWorkout);
  const workouts = useStore((s) => s.workouts);
  const last = lastCompletedFor(routine, workouts);
  return (
    <div className="card card-pad row">
      <button
        style={{ flex: 1, minWidth: 0, textAlign: 'left' }}
        onClick={() => nav({ view: 'routineEditor', id: routine.id })}
      >
        <span style={{ fontWeight: 700, fontSize: 16, display: 'block' }}>{routine.name}</span>
        <span className="mono small muted row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <span style={{ whiteSpace: 'nowrap' }}>
            {t('home.exercises', { n: routine.exercises.length })}
            {last ? ` · ${fmtDate(last.date, i18n.language)}` : ''}
          </span>
          {suggested && <span className="chip chip-accent">{t('home.suggested')}</span>}
        </span>
      </button>
      <button
        className={`btn ${suggested ? 'btn-accent' : 'btn-ghost'}`}
        disabled={routine.exercises.length === 0}
        onClick={() => startWorkout(routine.id)}
      >
        {t('home.start')}
      </button>
    </div>
  );
}

type SheetState =
  | { kind: 'create' }
  | { kind: 'newRoutine'; folderId?: string }
  | { kind: 'newProgram' }
  | { kind: 'program'; folder: Folder }
  | { kind: 'renameProgram'; folder: Folder }
  | { kind: 'deleteProgram'; folder: Folder }
  | null;

export function Train() {
  const { t } = useTranslation();
  const { settings, routines, folders, workouts } = useStore();
  const nav = useStore((s) => s.nav);
  const saveRoutine = useStore((s) => s.saveRoutine);
  const saveFolder = useStore((s) => s.saveFolder);
  const deleteFolder = useStore((s) => s.deleteFolder);
  const updateSettings = useStore((s) => s.updateSettings);
  const [pickDate, setPickDate] = useState(false);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [nameDraft, setNameDraft] = useState('');

  const ungrouped = routines.filter((r) => !r.folderId || !folders.some((f) => f.id === r.folderId));
  const missingPacks = TEMPLATES.filter(
    (p) => !p.routines.every((r) => routines.some((x) => x.id === r.id)),
  );

  const suggestedId = nextRoutine(routines, folders, workouts)?.id;

  async function createRoutine(name: string, folderId?: string): Promise<void> {
    const routine: Routine = {
      id: crypto.randomUUID(),
      name: name.trim() || t('routines.newName'),
      folderId,
      exercises: [],
      updatedAt: 0,
    };
    const result = await saveRoutine(routine);
    if (!isAccountActionCurrent(result)) return;
    setSheet(null);
    nav({ view: 'routineEditor', id: routine.id });
  }

  async function createProgram(name: string): Promise<void> {
    const folder: Folder = { id: crypto.randomUUID(), name: name.trim() || t('train.newProgram'), updatedAt: 0 };
    const result = await saveFolder(folder);
    if (!isAccountActionCurrent(result)) return;
    setSheet(null);
  }

  return (
    <div className="screen">
      <div className="spread" style={{ padding: '22px 0 6px' }}>
        <div className="display" style={{ fontSize: 30 }}>
          {t('nav.workout')}
        </div>
        <button className="btn btn-accent" style={{ padding: '10px 16px' }} onClick={() => { setNameDraft(''); setSheet({ kind: 'create' }); }}>
          {t('train.create')}
        </button>
      </div>

      {!settings.programStartDate ? (
        <div className="card card-pad stack" style={{ margin: '8px 0 14px' }}>
          <strong>{t('home.setStartTitle')}</strong>
          <span className="muted small">{t('home.setStartBody')}</span>
          <button
            className="btn btn-accent btn-block"
            onClick={() => void updateSettings({ programStartDate: new Date().toLocaleDateString('sv') })}
          >
            {t('home.startToday')}
          </button>
          {pickDate ? (
            <input
              type="date"
              aria-label={t('home.pickDate')}
              onChange={(e) => e.target.value && void updateSettings({ programStartDate: e.target.value })}
            />
          ) : (
            <button className="btn btn-ghost btn-block" onClick={() => setPickDate(true)}>
              {t('home.pickDate')}
            </button>
          )}
        </div>
      ) : (
        <MomentumCard />
      )}

      {routines.length === 0 && folders.length === 0 && (
        <div className="card card-pad stack">
          <strong>{t('home.welcomeTitle')}</strong>
          <span className="muted small">{t('home.welcomeBody')}</span>
        </div>
      )}

      <div className="stack">
        {ungrouped.length > 0 && (
          <div className="mono small muted" style={{ letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 6 }}>
            {t('routines.title')}
          </div>
        )}
        {ungrouped.map((r) => (
          <RoutineCard key={r.id} routine={r} suggested={r.id === suggestedId} />
        ))}

        {folders.map((f) => {
          const inFolder = routines.filter((r) => r.folderId === f.id);
          return (
            <div key={f.id} style={{ display: 'contents' }}>
              <button
                className="spread"
                style={{ margin: '10px 0 0', width: '100%', minHeight: 44 }}
                aria-label={`${f.name} · ${t('train.programOptions')}`}
                onClick={() => { setNameDraft(f.name); setSheet({ kind: 'program', folder: f }); }}
              >
                <span className="mono small muted" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {f.name} · {t('routines.days', { n: inFolder.length })}
                </span>
                <span className="muted"><IconForward width={15} height={15} aria-hidden /></span>
              </button>
              {inFolder.map((r) => (
                <RoutineCard key={r.id} routine={r} suggested={r.id === suggestedId} />
              ))}
              {inFolder.length === 0 && (
                <button className="card card-pad small muted" style={{ width: '100%', textAlign: 'left' }} onClick={() => { setNameDraft(''); setSheet({ kind: 'newRoutine', folderId: f.id }); }}>
                  {t('train.emptyProgram')}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {missingPacks.length > 0 && (
        <>
          <div className="mono small muted" style={{ margin: '24px 0 8px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {t('routines.templates')}
          </div>
          <div className="stack">
            {missingPacks.map((pack) => (
              <div key={pack.folder.id} className="card card-pad spread">
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 700, display: 'block' }}>{pack.folder.name}</span>
                  <span className="mono small muted">{t('routines.days', { n: pack.routines.length })}</span>
                </span>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    void installTemplatePack(pack, { saveFolder, saveRoutine });
                  }}
                >
                  {t('routines.useTemplate')}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {sheet && (
        <div className="sheet-scrim" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && setSheet(null)}>
          <div className="sheet card card-pad stack">
            {sheet.kind === 'create' && (
              <>
                <strong>{t('train.create')}</strong>
                <button className="btn btn-ghost btn-block" onClick={() => setSheet({ kind: 'newRoutine' })}>
                  {t('train.newRoutine')}
                </button>
                <button className="btn btn-ghost btn-block" onClick={() => setSheet({ kind: 'newProgram' })}>
                  {t('train.newProgram')}
                </button>
                <span className="muted small">{t('train.programHint')}</span>
              </>
            )}
            {(sheet.kind === 'newRoutine' || sheet.kind === 'newProgram' || sheet.kind === 'renameProgram') && (
              <>
                <strong>
                  {sheet.kind === 'newRoutine'
                    ? t('train.newRoutine')
                    : sheet.kind === 'newProgram'
                      ? t('train.newProgram')
                      : t('train.renameProgram')}
                </strong>
                <input
                  autoFocus
                  value={nameDraft}
                  placeholder={sheet.kind === 'newRoutine' ? t('train.routineNamePh') : t('train.programNamePh')}
                  aria-label={t('editor.name')}
                  style={{ fontFamily: 'inherit' }}
                  onChange={(e) => setNameDraft(e.target.value)}
                />
                <button
                  className="btn btn-accent btn-block"
                  onClick={() => {
                    if (sheet.kind === 'newRoutine') void createRoutine(nameDraft, sheet.folderId);
                    else if (sheet.kind === 'newProgram') void createProgram(nameDraft);
                    else {
                      void (async () => {
                        const result = await saveFolder({
                          ...sheet.folder,
                          name: nameDraft.trim() || sheet.folder.name,
                        });
                        if (isAccountActionCurrent(result)) setSheet(null);
                      })();
                    }
                  }}
                >
                  {sheet.kind === 'renameProgram' ? t('train.save') : t('train.createConfirm')}
                </button>
                <button className="btn btn-ghost btn-block" onClick={() => setSheet(null)}>
                  {t('workout.cancel')}
                </button>
              </>
            )}
            {sheet.kind === 'program' && (
              <>
                <strong>{sheet.folder.name}</strong>
                <button className="btn btn-ghost btn-block" onClick={() => { setNameDraft(''); setSheet({ kind: 'newRoutine', folderId: sheet.folder.id }); }}>
                  {t('train.addToProgram')}
                </button>
                <button className="btn btn-ghost btn-block" onClick={() => { setNameDraft(sheet.folder.name); setSheet({ kind: 'renameProgram', folder: sheet.folder }); }}>
                  {t('train.renameProgram')}
                </button>
                <button className="btn btn-danger btn-block" onClick={() => setSheet({ kind: 'deleteProgram', folder: sheet.folder })}>
                  {t('train.deleteFolder')}
                </button>
                <button className="btn btn-ghost btn-block" onClick={() => setSheet(null)}>
                  {t('workout.cancel')}
                </button>
              </>
            )}
            {sheet.kind === 'deleteProgram' && (
              <>
                <strong>{t('train.deleteFolder')}</strong>
                <span className="muted small">{t('train.deleteFolderBody')}</span>
                <button
                  className="btn btn-danger btn-block"
                  onClick={() => {
                    void (async () => {
                      const result = await deleteFolder(sheet.folder.id);
                      if (isAccountActionCurrent(result)) setSheet(null);
                    })();
                  }}
                >
                  {t('history.deleteConfirm')}
                </button>
                <button className="btn btn-ghost btn-block" onClick={() => setSheet(null)}>
                  {t('workout.cancel')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
