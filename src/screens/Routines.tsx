import { useTranslation } from 'react-i18next';
import { useStore } from '../state/useStore';
import type { Routine } from '../lib/types';

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
          ←
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
            <span className="muted">→</span>
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
    </div>
  );
}
