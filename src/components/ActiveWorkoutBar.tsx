import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconBarbell } from './Icons';
import { useStore } from '../state/useStore';

/** Hevy-style persistent banner: an in-progress workout is always one tap away. */
export function ActiveWorkoutBar() {
  const { t } = useTranslation();
  const active = useStore((s) => s.active);
  const route = useStore((s) => s.route);
  const routines = useStore((s) => s.routines);
  const restUntil = useStore((s) => s.restUntil);
  const nav = useStore((s) => s.nav);
  const [, tick] = useState(0);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [active]);

  if (!active || route.view === 'workout' || route.view === 'home') return null;
  const routine = routines.find((r) => r.id === active.routineId);
  const fmt = (secs: number): string =>
    `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  const resting = restUntil && restUntil > Date.now();
  const shown = resting
    ? fmt(Math.ceil((restUntil - Date.now()) / 1000))
    : fmt(Math.floor((Date.now() - active.startTs) / 1000));

  return (
    <button className="active-bar" onClick={() => nav({ view: 'workout' })}>
      <span className="row" style={{ gap: 8, minWidth: 0, flex: 1 }}>
        <IconBarbell width={16} height={16} aria-hidden style={{ flex: 'none' }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {routine?.name ?? t('nav.workout')}
        </span>
      </span>
      <span className="mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {resting ? `${t('timer.rest')} ${shown}` : shown}
      </span>
      <span style={{ fontWeight: 700 }}>{t('activeBar.resume')}</span>
    </button>
  );
}
