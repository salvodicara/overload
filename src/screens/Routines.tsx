import { IconBack, IconForward } from '../components/Icons';
import { useTranslation } from 'react-i18next';
import { useStore } from '../state/useStore';
import type { Routine } from '../lib/types';
import { TEMPLATES } from '../data/templates';

export function Routines() {
  const { t } = useTranslation();
  const routines = useStore((s) => s.routines);
  const nav = useStore((s) => s.nav);
  const saveRoutine = useStore((s) => s.saveRoutine);

  async function create(): Promise<void> {
    const routine: Routine = {
      id: crypto.randomUUID(),
      name: t('routines.newName'),
      days: [{ label: 'A', name: t('editor.dayDefault', { label: 'A' }), exercises: [] }],
      updatedAt: 0,
    };
    await saveRoutine(routine);
    nav({ view: 'routineEditor', id: routine.id });
  }

  return (
    <div className="screen">
      <div className="row" style={{ padding: '18px 0 6px' }}>
        <button
          className="iconbtn"
          aria-label={t('common.back')}
          onClick={() => nav({ view: 'settings' })}
        >
          <IconBack />
        </button>
        <div className="display" style={{ fontSize: 26 }}>
          {t('routines.title')}
        </div>
      </div>

      {routines.length === 0 && <div className="empty">{t('routines.empty')}</div>}

      <div className="stack" style={{ marginTop: 12 }}>
        {routines.map((r) => (
          <button
            key={r.id}
            className="card card-pad spread"
            style={{ width: '100%', textAlign: 'left' }}
            onClick={() => nav({ view: 'routineEditor', id: r.id })}
          >
            <span style={{ minWidth: 0 }}>
              <span className="display" style={{ fontSize: 20, display: 'block' }}>
                {r.name}
              </span>
              <span className="mono small muted">
                {t('routines.days', { n: r.days.length })} ·{' '}
                {t('routines.exercises', {
                  n: r.days.reduce((total, d) => total + d.exercises.length, 0),
                })}
              </span>
            </span>
            <span className="muted"><IconForward /></span>
          </button>
        ))}
      </div>

      <button
        className="btn btn-ghost btn-block"
        style={{ marginTop: 14 }}
        onClick={() => void create()}
      >
        {t('routines.new')}
      </button>

      {TEMPLATES.some((tpl) => !routines.some((r) => r.id === tpl.id)) && (
        <>
          <div className="mono small muted" style={{ margin: '22px 0 8px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {t('routines.templates')}
          </div>
          <div className="stack">
            {TEMPLATES.filter((tpl) => !routines.some((r) => r.id === tpl.id)).map((tpl) => (
              <div key={tpl.id} className="card card-pad spread">
                <span style={{ minWidth: 0 }}>
                  <span className="display" style={{ fontSize: 18, display: 'block' }}>{tpl.name}</span>
                  <span className="mono small muted">
                    {t('routines.days', { n: tpl.days.length })} ·{' '}
                    {t('routines.exercises', { n: tpl.days.reduce((n, d) => n + d.exercises.length, 0) })}
                  </span>
                </span>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    void saveRoutine(structuredClone(tpl)).then(() => nav({ view: 'routineEditor', id: tpl.id }));
                  }}
                >
                  {t('routines.useTemplate')}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
