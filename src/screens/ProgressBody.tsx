import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconX } from '../components/Icons';
import { LineChart } from '../components/LineChart';
import { todayISO } from '../lib/format';
import { continueAccountAction, useStore } from '../state/useStore';
import type { MeasureMetric } from '../lib/types';

const METRICS: MeasureMetric[] = ['weight', 'waist', 'chest', 'arm', 'thigh', 'calf'];

export function ProgressBody() {
  const { t, i18n } = useTranslation();
  const measurements = useStore((s) => s.measurements);
  const addMeasurement = useStore((s) => s.addMeasurement);
  const deleteMeasurement = useStore((s) => s.deleteMeasurement);
  const [metric, setMetric] = useState<MeasureMetric>('weight');
  const [adding, setAdding] = useState(false);
  const [valueDraft, setValueDraft] = useState('');
  const [dateDraft, setDateDraft] = useState(todayISO());

  const rows = measurements.filter((m) => m.metric === metric);
  const latest = rows[rows.length - 1];
  const unit = metric === 'weight' ? 'kg' : 'cm';

  // Weekly average for body weight: the number that actually matters on a bulk.
  const weeklyAvg = (() => {
    if (metric !== 'weight' || rows.length === 0) return null;
    const start = new Date(`${todayISO()}T12:00:00`);
    start.setDate(start.getDate() - 6);
    const cut = start.toLocaleDateString('sv');
    const recent = rows.filter((m) => m.date >= cut);
    if (recent.length === 0) return null;
    return recent.reduce((a, m) => a + m.value, 0) / recent.length;
  })();

  return (
    <div className="stack" style={{ marginTop: 4 }}>
      <div className="row" style={{ gap: 6, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
        {METRICS.map((m) => (
          <button
            key={m}
            className={`chip${metric === m ? ' chip-accent' : ''}`}
            style={{ padding: '7px 12px', fontSize: 12.5 }}
            aria-pressed={metric === m}
            onClick={() => setMetric(m)}
          >
            {t(`body.${m}`)}
          </button>
        ))}
      </div>

      <div className="row" style={{ gap: 10 }}>
        <div className="card card-pad" style={{ flex: 1 }}>
          <div className="mono muted" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {t('body.latest')}
          </div>
          <div className="display" style={{ fontSize: 26 }}>
            {latest ? latest.value.toLocaleString(i18n.language) : '-'}
            <span className="small muted" style={{ fontFamily: 'var(--font-body)', fontWeight: 600 }}> {unit}</span>
          </div>
        </div>
        {weeklyAvg !== null && (
          <div className="card card-pad" style={{ flex: 1 }}>
            <div className="mono muted" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {t('body.weeklyAvg')}
            </div>
            <div className="display" style={{ fontSize: 26 }}>
              {(Math.round(weeklyAvg * 10) / 10).toLocaleString(i18n.language)}
              <span className="small muted" style={{ fontFamily: 'var(--font-body)', fontWeight: 600 }}> kg</span>
            </div>
          </div>
        )}
      </div>

      {rows.length > 1 && (
        <div className="card" style={{ padding: 16 }}>
          <LineChart points={rows.map((m) => ({ date: m.date, value: m.value }))} />
        </div>
      )}

      {adding ? (
        <div className="card card-pad stack">
          <div className="row">
            <input
              type="number"
              inputMode="decimal"
              step={0.1}
              min={0}
              autoFocus
              placeholder={unit}
              aria-label={t(`body.${metric}`)}
              value={valueDraft}
              onChange={(e) => setValueDraft(e.target.value)}
            />
            <input
              type="date"
              aria-label={t('home.pickDate')}
              value={dateDraft}
              onChange={(e) => e.target.value && setDateDraft(e.target.value)}
            />
          </div>
          <div className="row">
            <button
              className="btn btn-accent"
              style={{ flex: 1 }}
              disabled={!valueDraft || Number(valueDraft) <= 0}
              onClick={() => {
                void continueAccountAction(
                  addMeasurement(metric, Number(valueDraft), dateDraft),
                  () => {
                    setValueDraft('');
                    setAdding(false);
                  },
                );
              }}
            >
              {t('train.save')}
            </button>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setAdding(false)}>
              {t('workout.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn-ghost btn-block" onClick={() => { setDateDraft(todayISO()); setAdding(true); }}>
          {t('body.add')}
        </button>
      )}

      {rows.length > 0 && (
        <div className="card">
          {rows
            .slice()
            .reverse()
            .slice(0, 10)
            .map((m, i) => (
              <div key={m.id} className="spread card-pad" style={{ borderTop: i ? '1px solid var(--line)' : 'none', paddingTop: 10, paddingBottom: 10 }}>
                <span className="mono small muted">{m.date}</span>
                <span className="row" style={{ gap: 10 }}>
                  <span className="mono" style={{ fontWeight: 600 }}>
                    {m.value.toLocaleString(i18n.language)} {unit}
                  </span>
                  <button
                    className="muted"
                    aria-label={t('history.delete')}
                    style={{ display: 'flex', padding: 6 }}
                    onClick={() => void deleteMeasurement(m.id)}
                  >
                    <IconX width={13} height={13} />
                  </button>
                </span>
              </div>
            ))}
        </div>
      )}
      {rows.length === 0 && <div className="empty">{t('body.empty')}</div>}
    </div>
  );
}
