
import { useTranslation } from 'react-i18next';
import { useStore } from '../state/useStore';
import type { Workout } from '../lib/types';

function fmtDate(iso: string, locale: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(locale === 'it' ? 'it-IT' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function fmtMonth(iso: string, locale: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(locale === 'it' ? 'it-IT' : 'en-GB', {
    month: 'long',
    year: 'numeric',
  });
}

/** Workouts (already date desc) split into month buckets, order preserved. */
function byMonth(workouts: Workout[]): { key: string; items: Workout[] }[] {
  const out: { key: string; items: Workout[] }[] = [];
  for (const w of workouts) {
    const key = w.date.slice(0, 7);
    const last = out[out.length - 1];
    if (last?.key === key) last.items.push(w);
    else out.push({ key, items: [w] });
  }
  return out;
}

export function History() {
  const { t, i18n } = useTranslation();
  const { workouts } = useStore();
  const nav = useStore((s) => s.nav);

  return (
    <div className="screen">
      <div className="display screen-title">{t('history.title')}</div>

      {workouts.length === 0 ? (
        <div className="empty">{t('history.empty')}</div>
      ) : (
        byMonth(workouts).map((group) => (
          <div key={group.key} style={{ marginBottom: 18 }}>
            <div className="row mono small muted" style={{ padding: '4px 0 10px' }}>
              <span style={{ textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: 11 }}>
                {fmtMonth(`${group.key}-01`, i18n.language)}
              </span>
              <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            </div>
            <div className="stack">
              {group.items.map((w) => {
                const hasPr = w.sets.some((s) => s.isPr);
                return (
                  <button
                    key={w.id}
                    className="card card-pad row"
                    style={{ width: '100%', textAlign: 'left' }}
                    onClick={() => nav({ view: 'workoutDetail', id: w.id })}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="mono small muted">{fmtDate(w.date, i18n.language)}</div>
                      <div
                        className="display"
                        style={{ fontSize: 19, color: w.dayLabel ? undefined : 'var(--muted)' }}
                      >
                        {w.dayLabel ?? '-'}
                      </div>
                      <div className="row" style={{ gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
                        <span className="chip">{t('history.sets', { n: w.sets.length })}</span>
                        {w.source !== 'app' && <span className="chip">{t('history.imported')}</span>}
                        {hasPr && <span className="chip chip-good">{t('history.pr')}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="mono" style={{ fontSize: 22, fontWeight: 700 }}>
                        {Math.round(w.volumeKg).toLocaleString(i18n.language)}
                      </div>
                      <div className="mono small muted">{t('workout.kg')}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
