import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '../components/BottomSheet';
import { IconDown, IconForward, IconMore } from '../components/Icons';
import { PageHeader } from '../components/PageHeader';
import { useSurfaceState } from '../hooks/useSurfaceState';
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
    <li className={`train-routine${suggested ? ' train-routine--suggested' : ''}`}>
      <button
        className="train-routine__edit"
        aria-label={t('routines.edit', { routine: routine.name })}
        onClick={() => nav({ view: 'routineEditor', id: routine.id })}
      >
        <strong>{routine.name}</strong>
        <span className="train-routine__meta">
          <span>{t('home.exercises', { count: routine.exercises.length })}</span>
          {last && <span>{fmtDate(last.date, i18n.language)}</span>}
          {suggested && <span className="train-routine__suggestion">{t('home.suggested')}</span>}
        </span>
      </button>
      <button
        className={`btn train-routine__start ${suggested ? 'btn-accent' : 'btn-ghost'}`}
        aria-label={t('routines.start', { routine: routine.name })}
        disabled={routine.exercises.length === 0}
        onClick={() => startWorkout(routine.id)}
      >
        {t('home.start')}
      </button>
    </li>
  );
}

type SheetState =
  | { kind: 'create' }
  | { kind: 'newRoutine'; folderId?: string }
  | { kind: 'newProgram' }
  | { kind: 'program'; folder: Folder }
  | { kind: 'renameProgram'; folder: Folder }
  | { kind: 'deleteProgram'; folder: Folder }
  | { kind: 'explore' }
  | null;

export function Train() {
  const { t } = useTranslation();
  const { routines, folders, workouts, settings } = useStore();
  const nav = useStore((s) => s.nav);
  const saveRoutine = useStore((s) => s.saveRoutine);
  const saveFolder = useStore((s) => s.saveFolder);
  const deleteFolder = useStore((s) => s.deleteFolder);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [nameDraft, setNameDraft] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);

  const ungrouped = routines.filter(
    (r) => !r.folderId || !folders.some((f) => f.id === r.folderId),
  );
  const missingPacks = TEMPLATES.filter(
    (p) => !p.routines.every((r) => routines.some((x) => x.id === r.id)),
  );

  const suggestedId = nextRoutine(routines, folders, workouts, settings.programStartDate)?.id;
  const suggestedFolderId = routines.find((routine) => routine.id === suggestedId)?.folderId;
  const [surface, setSurface] = useSurfaceState('train', {
    openProgramId: suggestedFolderId ?? folders[0]?.id ?? null,
  });
  const openProgramId = surface.openProgramId ?? null;
  const setOpenProgramId = (openProgramId: string | null): void =>
    setSurface((current) => ({ ...current, openProgramId }));
  const sheetTitle = !sheet
    ? ''
    : sheet.kind === 'create'
      ? t('train.create')
      : sheet.kind === 'explore'
        ? t('train.explorePrograms')
        : sheet.kind === 'newRoutine'
          ? t('train.newRoutine')
          : sheet.kind === 'newProgram'
            ? t('train.newProgram')
            : sheet.kind === 'renameProgram'
              ? t('train.renameProgram')
              : sheet.kind === 'program'
                ? sheet.folder.name
                : t('train.deleteFolder');

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
    const folder: Folder = {
      id: crypto.randomUUID(),
      name: name.trim() || t('train.newProgram'),
      updatedAt: 0,
    };
    const result = await saveFolder(folder);
    if (!isAccountActionCurrent(result)) return;
    setOpenProgramId(folder.id);
    setSheet(null);
  }

  async function addTemplate(pack: (typeof TEMPLATES)[number]): Promise<void> {
    const result = await installTemplatePack(pack, { saveFolder, saveRoutine });
    if (!isAccountActionCurrent(result)) return;
    setOpenProgramId(pack.folder.id);
    setSheet(null);
  }

  return (
    <div className="screen">
      <PageHeader
        title={t('nav.workout')}
        action={
          <button
            className="btn btn-ghost train-create"
            onClick={() => {
              setNameDraft('');
              setSheet({ kind: 'create' });
            }}
          >
            {t('train.create')}
          </button>
        }
      />

      {routines.length === 0 && folders.length === 0 && (
        <div className="train-empty">
          <strong>{t('home.welcomeTitle')}</strong>
          <span className="muted small">{t('home.welcomeBody')}</span>
        </div>
      )}

      <div className="train-groups">
        {ungrouped.length > 0 && (
          <section className="train-group" aria-labelledby="standalone-routines">
            <h2 id="standalone-routines" className="train-group__title">
              {t('routines.title')}
            </h2>
            <ul className="train-routine-list">
              {ungrouped.map((routine) => (
                <RoutineCard
                  key={routine.id}
                  routine={routine}
                  suggested={routine.id === suggestedId}
                />
              ))}
            </ul>
          </section>
        )}

        {folders.map((folder) => {
          const inFolder = routines.filter((routine) => routine.folderId === folder.id);
          const headingId = `program-${folder.id}`;
          const contentId = `${headingId}-routines`;
          const expanded = openProgramId === folder.id;
          return (
            <section
              key={folder.id}
              className={`train-group train-program${expanded ? ' train-program--open' : ''}`}
              aria-labelledby={headingId}
            >
              <div className="train-group__heading">
                <button
                  type="button"
                  className="train-program__toggle"
                  aria-expanded={expanded}
                  aria-controls={contentId}
                  aria-label={`${folder.name}, ${t('routines.days', { count: inFolder.length })}`}
                  onClick={() => setOpenProgramId(expanded ? null : folder.id)}
                >
                  <span>
                    <h2 id={headingId} className="train-group__title">
                      {folder.name}
                    </h2>
                    <span className="train-group__count">
                      {t('routines.days', { count: inFolder.length })}
                    </span>
                  </span>
                  <IconDown className="train-program__chevron" width={18} height={18} aria-hidden />
                </button>
                <button
                  className="iconbtn train-group__options"
                  aria-label={`${folder.name}, ${t('train.programOptions')}`}
                  onClick={() => {
                    setNameDraft(folder.name);
                    setSheet({ kind: 'program', folder });
                  }}
                >
                  <IconMore width={18} height={18} aria-hidden />
                </button>
              </div>
              <div
                id={contentId}
                className="train-program__content"
                aria-hidden={!expanded}
                inert={expanded ? undefined : true}
              >
                <div className="train-program__content-inner">
                  <ul className="train-routine-list">
                    {inFolder.map((routine) => (
                      <RoutineCard
                        key={routine.id}
                        routine={routine}
                        suggested={routine.id === suggestedId}
                      />
                    ))}
                    {inFolder.length === 0 && (
                      <li>
                        <button
                          className="train-empty-program"
                          onClick={() => {
                            setNameDraft('');
                            setSheet({ kind: 'newRoutine', folderId: folder.id });
                          }}
                        >
                          {t('train.emptyProgram')}
                        </button>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </section>
          );
        })}

        {missingPacks.length > 0 && (
          <section className="train-explore" aria-labelledby="explore-programs">
            <div>
              <h2 id="explore-programs" className="train-group__title">
                {t('train.explorePrograms')}
              </h2>
              <p className="muted small">{t('train.exploreHint')}</p>
            </div>
            <button className="btn btn-ghost" onClick={() => setSheet({ kind: 'explore' })}>
              {t('train.exploreAction')}
            </button>
          </section>
        )}
      </div>

      {sheet && (
        <BottomSheet
          open
          title={sheetTitle}
          initialFocusRef={sheet.kind === 'deleteProgram' ? cancelDeleteRef : nameInputRef}
          closeOnScrim={sheet.kind !== 'deleteProgram'}
          onClose={() => setSheet(null)}
        >
          {sheet.kind === 'create' && (
            <div className="train-create-options">
              <button
                className="train-create-option"
                aria-label={t('train.newRoutine')}
                onClick={() => setSheet({ kind: 'newRoutine' })}
              >
                <strong>{t('train.newRoutine')}</strong>
                <span>{t('train.newRoutineHint')}</span>
                <IconForward aria-hidden />
              </button>
              <button
                className="train-create-option"
                aria-label={t('train.newProgram')}
                onClick={() => setSheet({ kind: 'newProgram' })}
              >
                <strong>{t('train.newProgram')}</strong>
                <span>{t('train.newProgramHint')}</span>
                <IconForward aria-hidden />
              </button>
            </div>
          )}
          {sheet.kind === 'explore' && (
            <ul className="train-routine-list train-explore-list">
              {missingPacks.map((pack) => (
                <li key={pack.folder.id} className="train-template">
                  <span className="train-template__copy">
                    <strong>{pack.folder.name}</strong>
                    <span>{t('routines.days', { count: pack.routines.length })}</span>
                    <small>{t(`train.pack.${pack.folder.id}`)}</small>
                  </span>
                  <button
                    className="btn btn-ghost train-template__action"
                    onClick={() => void addTemplate(pack)}
                  >
                    {t('routines.useTemplate')}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {(sheet.kind === 'newRoutine' ||
            sheet.kind === 'newProgram' ||
            sheet.kind === 'renameProgram') && (
            <>
              <input
                ref={nameInputRef}
                autoFocus
                value={nameDraft}
                placeholder={
                  sheet.kind === 'newRoutine' ? t('train.routineNamePh') : t('train.programNamePh')
                }
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
              <button
                className="btn btn-ghost btn-block"
                onClick={() => {
                  setNameDraft('');
                  setSheet({ kind: 'newRoutine', folderId: sheet.folder.id });
                }}
              >
                {t('train.addToProgram')}
              </button>
              <button
                className="btn btn-ghost btn-block"
                onClick={() => {
                  setNameDraft(sheet.folder.name);
                  setSheet({ kind: 'renameProgram', folder: sheet.folder });
                }}
              >
                {t('train.renameProgram')}
              </button>
              <button
                className="btn btn-danger btn-block"
                onClick={() => setSheet({ kind: 'deleteProgram', folder: sheet.folder })}
              >
                {t('train.deleteFolder')}
              </button>
              <button className="btn btn-ghost btn-block" onClick={() => setSheet(null)}>
                {t('workout.cancel')}
              </button>
            </>
          )}
          {sheet.kind === 'deleteProgram' && (
            <>
              <span className="muted small">
                {t('train.deleteFolderBody', {
                  program: sheet.folder.name,
                  count: routines.filter((routine) => routine.folderId === sheet.folder.id).length,
                })}
              </span>
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
              <button
                ref={cancelDeleteRef}
                className="btn btn-ghost btn-block"
                onClick={() => setSheet(null)}
              >
                {t('workout.cancel')}
              </button>
            </>
          )}
        </BottomSheet>
      )}
    </div>
  );
}
