import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconX } from '../components/Icons';
import { TEMPLATES } from '../data/templates';
import { fmtDate } from '../lib/format';
import { useStore } from '../state/useStore';
import type { Routine } from '../lib/types';

function RoutineCard({ routine, suggested }: { routine: Routine; suggested?: boolean }) {
  const { t, i18n } = useTranslation();
  const nav = useStore((s) => s.nav);
  const startWorkout = useStore((s) => s.startWorkout);
  const workouts = useStore((s) => s.workouts);
  const last = workouts.find((w) => w.routineId === routine.id || w.dayLabel === routine.name);
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

export function Train() {
  const { t } = useTranslation();
  const { settings, routines, folders, active } = useStore();
  const nav = useStore((s) => s.nav);
  const saveRoutine = useStore((s) => s.saveRoutine);
  const saveFolder = useStore((s) => s.saveFolder);
  const deleteFolder = useStore((s) => s.deleteFolder);
  const updateSettings = useStore((s) => s.updateSettings);
  const phase = useStore((s) => s.phase)();
  const [pickDate, setPickDate] = useState(false);
  const [confirmFolder, setConfirmFolder] = useState<string | null>(null);

  const workouts = useStore((s) => s.workouts);
  const ungrouped = routines.filter((r) => !r.folderId || !folders.some((f) => f.id === r.folderId));

  // Within a program (folder), suggest the routine trained least recently:
  // did A, C, D this week -> B is up.
  function suggestedIn(group: Routine[]): string | null {
    if (group.length < 2) return null;
    let pick: string | null = null;
    let oldest = Infinity;
    for (const r of group) {
      if (r.exercises.length === 0) continue;
      const last = workouts.find((w) => w.routineId === r.id || w.dayLabel === r.name);
      const ts = last ? new Date(`${last.date}T12:00:00`).getTime() : 0;
      if (ts < oldest) {
        oldest = ts;
        pick = r.id;
      }
    }
    return pick;
  }
  const missingPacks = TEMPLATES.filter(
    (p) => !p.routines.every((r) => routines.some((x) => x.id === r.id)),
  );

  async function createRoutine(): Promise<void> {
    const routine: Routine = {
      id: crypto.randomUUID(),
      name: t('routines.newName'),
      exercises: [],
      updatedAt: 0,
    };
    await saveRoutine(routine);
    nav({ view: 'routineEditor', id: routine.id });
  }

  return (
    <div className="screen">
      <div className="display screen-title">{t('nav.workout')}</div>

      {!settings.programStartDate ? (
        <div className="card card-pad stack" style={{ marginBottom: 14 }}>
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
      ) : phase ? (
        <div className="card card-pad" style={{ marginBottom: 14 }}>
          <div className="spread">
            <strong style={{ fontSize: 14 }}>{t(`phase.${phase.key}`)}</strong>
            <span className="mono small muted">{t('phase.week', { n: phase.week })}</span>
          </div>
          <div className="row" style={{ gap: 3, marginTop: 8 }}>
            {Array.from({ length: 9 }, (_, i) => (
              <span
                key={i}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  background: i < Math.min(phase.week, 9) ? 'var(--accent)' : 'var(--surface2)',
                }}
              />
            ))}
          </div>
        </div>
      ) : null}

      {active && (
        <button className="btn btn-solid btn-block" style={{ marginBottom: 14 }} onClick={() => nav({ view: 'workout' })}>
          {t('home.resume')}
        </button>
      )}

      <div className="spread" style={{ margin: '6px 0 10px' }}>
        <span className="mono small muted" style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {t('routines.title')}
        </span>
        <button className="small" style={{ color: 'var(--accent-text)', fontWeight: 700 }} onClick={() => void createRoutine()}>
          {t('routines.new')}
        </button>
      </div>

      {routines.length === 0 && (
        <div className="card card-pad stack">
          <strong>{t('home.welcomeTitle')}</strong>
          <span className="muted small">{t('home.welcomeBody')}</span>
        </div>
      )}

      <div className="stack">
        {ungrouped.map((r) => (
          <RoutineCard key={r.id} routine={r} suggested={r.id === suggestedIn(ungrouped)} />
        ))}
        {folders.map((f) => {
          const inFolder = routines.filter((r) => r.folderId === f.id);
          if (inFolder.length === 0) return null;
          return (
            <div key={f.id} style={{ display: 'contents' }}>
              <div className="spread" style={{ margin: '10px 0 0' }}>
                <span className="mono small muted" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {f.name}
                </span>
                <button
                  className="iconbtn"
                  style={{ width: 34, height: 34 }}
                  aria-label={t('train.deleteFolder')}
                  onClick={() => setConfirmFolder(f.id)}
                >
                  <IconX width={13} height={13} />
                </button>
              </div>
              {inFolder.map((r) => (
                <RoutineCard key={r.id} routine={r} suggested={r.id === suggestedIn(inFolder)} />
              ))}
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
                  <span className="mono small muted">
                    {t('routines.days', { n: pack.routines.length })}
                  </span>
                </span>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    void (async () => {
                      await saveFolder(structuredClone(pack.folder));
                      for (const r of pack.routines) await saveRoutine(structuredClone(r));
                    })();
                  }}
                >
                  {t('routines.useTemplate')}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {confirmFolder && (
        <div className="sheet-scrim" role="dialog" aria-modal="true">
          <div className="sheet card card-pad stack">
            <strong>{t('train.deleteFolder')}</strong>
            <span className="muted small">{t('train.deleteFolderBody')}</span>
            <button
              className="btn btn-danger btn-block"
              onClick={() => {
                void deleteFolder(confirmFolder);
                setConfirmFolder(null);
              }}
            >
              {t('history.deleteConfirm')}
            </button>
            <button className="btn btn-ghost btn-block" onClick={() => setConfirmFolder(null)}>
              {t('workout.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
