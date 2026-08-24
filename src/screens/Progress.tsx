import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LineChart, type ChartPoint } from '../components/LineChart';
import { exerciseName, getCatalog } from '../lib/exercises';
import { useStore } from '../state/useStore';
import type { Workout } from '../lib/types';

/** Monday of the ISO week containing `iso`, as YYYY-MM-DD — the week bucket key. */
function isoWeekStart(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function weeklyVolume(workouts: Workout[]): { week: string; volumeKg: number }[] {
  const totals = new Map<string, number>();
  for (const w of workouts) {
    const key = isoWeekStart(w.date);
    totals.set(key, (totals.get(key) ?? 0) + w.volumeKg);
  }
  return [...totals.entries()]
    .map(([week, volumeKg]) => ({ week, volumeKg }))
    .sort((a, b) => a.week.localeCompare(b.week))
    .slice(-12);
}

/** Heaviest completed set of `exerciseId` per session, chronological. */
function topSets(
  workouts: Workout[],
  exerciseId: string,
): { date: string; weightKg: number; reps: number; isPr: boolean }[] {
  const out: { date: string; weightKg: number; reps: number; isPr: boolean }[] = [];
  for (const w of workouts) {
    let best: { weightKg: number; reps: number } | null = null;
    let isPr = false;
    for (const s of w.sets) {
      if (s.exerciseId !== exerciseId || !s.done) continue;
      if (s.isPr) isPr = true;
      if (!best || s.weightKg > best.weightKg || (s.weightKg === best.weightKg && s.reps > best.reps)) {
        best = { weightKg: s.weightKg, reps: s.reps };
      }
    }
    if (best) out.push({ date: w.date, ...best, isPr });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function Progress() {
  const { t, i18n } = useTranslation();
  const { workouts, catalogReady } = useStore();
  const [picked, setPicked] = useState<string | null>(null);
  const locale = i18n.language === 'it' ? 'it-IT' : 'en-GB';

  const options = useMemo(() => {
    void catalogReady;
    const ids = new Set<string>();
    for (const w of workouts) for (const s of w.sets) ids.add(s.exerciseId);
    return [...ids]
      .map((id) => ({ id, name: exerciseName(id, i18n.language), known: getCatalog().has(id) }))
      .sort((a, b) => Number(b.known) - Number(a.known) || a.name.localeCompare(b.name));
  }, [workouts, catalogReady, i18n.language]);

  const selected = picked && options.some((o) => o.id === picked) ? picked : options[0]?.id;
  const sessions = useMemo(
    () => (selected ? topSets(workouts, selected) : []),
    [workouts, selected],
  );
  const weeks = useMemo(() => weeklyVolume(workouts), [workouts]);

  if (options.length === 0) {
    return (
      <div className="screen">
        <div className="display screen-title">{t('progress.title')}</div>
        <div className="empty">{t('history.empty')}</div>
      </div>
    );
  }

  const points: ChartPoint[] = sessions.map((s) => ({
    date: s.date,
    value: s.weightKg,
    highlight: s.isPr,
  }));
  const best = sessions.reduce<(typeof sessions)[number] | null>(
    (acc, s) => (!acc || s.weightKg > acc.weightKg ? s : acc),
    null,
  );
  const last = sessions[sessions.length - 1] ?? null;
  const kg = (n: number): string => n.toLocaleString(locale);
  const maxWeek = Math.max(...weeks.map((w) => w.volumeKg), 1);
  const fmtWeek = (iso: string): string =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'numeric' });

  return (
    <div className="screen">
      <div className="display screen-title">{t('progress.title')}</div>

      <label className="mono small muted" htmlFor="progress-exercise">
        {t('progress.pick')}
      </label>
      <select
        id="progress-exercise"
        style={{ marginTop: 6 }}
        value={selected}
        onChange={(e) => setPicked(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>

      <div className="card card-pad" style={{ marginTop: 12 }}>
        <div
          role="img"
          aria-label={`${selected ? exerciseName(selected, i18n.language) : ''} — ${t('progress.caption')}`}
        >
          <LineChart points={points} />
        </div>
        <div className="small muted" style={{ marginTop: 6 }}>
          {t('progress.caption')}
        </div>
      </div>

      <div className="row" style={{ marginTop: 12, alignItems: 'stretch' }}>
        {[
          {
            key: 'progress.best',
            value: best ? kg(best.weightKg) : '—',
            sub: best ? `${t('workout.kg')} × ${best.reps}` : '',
          },
          {
            key: 'progress.last',
            value: last ? kg(last.weightKg) : '—',
            sub: last ? `${t('workout.kg')} × ${last.reps}` : '',
          },
          { key: 'progress.sessions', value: sessions.length.toLocaleString(locale), sub: '' },
        ].map((tile) => (
          <div key={tile.key} className="card card-pad" style={{ flex: 1, minWidth: 0 }}>
            <div
              className="mono muted"
              style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.1em' }}
            >
              {t(tile.key)}
            </div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
              {tile.value}
            </div>
            {tile.sub && <div className="mono small muted">{tile.sub}</div>}
          </div>
        ))}
      </div>

      <div className="card card-pad" style={{ marginTop: 12 }}>
        <div
          className="mono muted"
          style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.1em' }}
        >
          {t('progress.volumeWeek')}
        </div>
        <div
          className="row"
          style={{ gap: 2, alignItems: 'flex-end', height: 96, marginTop: 12 }}
          role="img"
          aria-label={`${t('progress.volumeWeek')}: ${weeks
            .map((w) => `${fmtWeek(w.week)} ${Math.round(w.volumeKg)} ${t('workout.kg')}`)
            .join(', ')}`}
        >
          {weeks.map((w) => (
            <div
              key={w.week}
              title={`${fmtWeek(w.week)} · ${Math.round(w.volumeKg).toLocaleString(locale)} ${t('workout.kg')}`}
              style={{
                flex: 1,
                maxWidth: 24,
                height: `${Math.max(3, (w.volumeKg / maxWeek) * 100)}%`,
                background: 'var(--accent)',
                borderRadius: '4px 4px 0 0',
              }}
            />
          ))}
        </div>
        <div className="spread mono small muted" style={{ marginTop: 8 }}>
          <span>{weeks.length ? fmtWeek(weeks[0].week) : ''}</span>
          <span>
            {weeks.length
              ? `${Math.round(weeks[weeks.length - 1].volumeKg).toLocaleString(locale)} ${t('workout.kg')}`
              : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
