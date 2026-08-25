import { useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '../components/BottomSheet';
import { IconX } from '../components/Icons';
import { LineChart } from '../components/LineChart';
import { fmtDate, todayISO } from '../lib/format';
import type { MeasureMetric } from '../lib/types';
import { canonicalWeight, displayWeight, weightLabel } from '../lib/units';
import { continueAccountAction, useStore } from '../state/useStore';

const METRICS: MeasureMetric[] = ['weight', 'waist', 'chest', 'arm', 'thigh', 'calf'];

type PendingMeasurementRemoval = {
  id: string;
  date: string;
  metric: string;
  value: string;
};

export function ProgressBody() {
  const { t, i18n } = useTranslation();
  const measurements = useStore((state) => state.measurements);
  const settings = useStore((state) => state.settings);
  const addMeasurement = useStore((state) => state.addMeasurement);
  const deleteMeasurement = useStore((state) => state.deleteMeasurement);
  const [metric, setMetric] = useState<MeasureMetric>('weight');
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [valueDraft, setValueDraft] = useState('');
  const [dateDraft, setDateDraft] = useState(todayISO());
  const [pendingRemoval, setPendingRemoval] = useState<PendingMeasurementRemoval | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deletingRef = useRef(false);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const locale = i18n.language === 'it' ? 'it-IT' : 'en-GB';
  const selectedUnit = settings.unit ?? 'kg';
  const unit = metric === 'weight' ? weightLabel(selectedUnit) : 'cm';
  const metricName = t(`body.${metric}`);

  const rows = measurements
    .filter((measurement) => measurement.metric === metric)
    .sort((left, right) => left.date.localeCompare(right.date));
  const latest = rows[rows.length - 1];
  const displayValue = (value: number): number =>
    metric === 'weight' ? displayWeight(value, selectedUnit) : value;
  const formatValue = (value: number): string =>
    `${displayValue(value).toLocaleString(locale)} ${unit}`;

  const weeklyAverage = (() => {
    if (metric !== 'weight' || rows.length === 0) return null;
    const start = new Date(`${todayISO()}T12:00:00`);
    start.setDate(start.getDate() - 6);
    const recent = rows.filter((measurement) => measurement.date >= start.toLocaleDateString('sv'));
    return recent.length
      ? recent.reduce((sum, measurement) => sum + measurement.value, 0) / recent.length
      : null;
  })();

  const closeForm = (): void => {
    setValueDraft('');
    setSaveError(false);
    setAdding(false);
  };

  const add = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const value = Number(valueDraft);
    if (saving || !Number.isFinite(value) || value <= 0) return;
    const canonical = metric === 'weight' ? canonicalWeight(value, selectedUnit) : value;
    setSaveError(false);
    setSaving(true);
    void continueAccountAction(addMeasurement(metric, canonical, dateDraft), closeForm)
      .catch(() => setSaveError(true))
      .finally(() => setSaving(false));
  };

  const closeDelete = (): void => {
    if (!deletingRef.current) setPendingRemoval(null);
  };

  const confirmDelete = (): void => {
    if (!pendingRemoval || deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(true);
    setSaveError(false);
    void continueAccountAction(deleteMeasurement(pendingRemoval.id), () => setPendingRemoval(null))
      .catch(() => setSaveError(true))
      .finally(() => {
        deletingRef.current = false;
        setDeleting(false);
      });
  };

  const trendTitleId = 'body-trend-title';
  const chartLabel =
    rows.length > 1
      ? t('body.chartSummary', {
          metric: metricName,
          count: rows.length,
          first: `${fmtDate(rows[0].date, i18n.language)} ${formatValue(rows[0].value)}`,
          last: `${fmtDate(latest.date, i18n.language)} ${formatValue(latest.value)}`,
        })
      : '';

  return (
    <div className="body-progress">
      <div className="body-metrics library-filters" role="group" aria-label={t('body.metricGroup')}>
        {METRICS.map((candidate) => (
          <button
            key={candidate}
            className="library-filter"
            aria-pressed={metric === candidate}
            disabled={saving}
            onClick={() => {
              closeForm();
              setMetric(candidate);
            }}
          >
            {t(`body.${candidate}`)}
          </button>
        ))}
      </div>

      <dl
        className="body-summary"
        role="group"
        aria-label={t('body.summary', { metric: metricName })}
      >
        <div>
          <dt>{t('body.latest')}</dt>
          <dd>{latest ? formatValue(latest.value) : '−'}</dd>
        </div>
        {metric === 'weight' && (
          <div>
            <dt>{t('body.weeklyAvg')}</dt>
            <dd>{weeklyAverage === null ? '−' : formatValue(weeklyAverage)}</dd>
          </div>
        )}
      </dl>

      <section className="body-trend card card-pad" aria-labelledby={trendTitleId}>
        <h2 id={trendTitleId} className="progress-section-title">
          {t('body.trend', { metric: metricName })}
        </h2>
        {rows.length === 0 && (
          <p className="progress-state">{t('body.emptyMetric', { metric: metricName })}</p>
        )}
        {rows.length === 1 && (
          <p className="progress-state">
            <strong className="mono">{formatValue(rows[0].value)}</strong>
            <br />
            <span className="small muted">{t('body.onePoint')}</span>
          </p>
        )}
        {rows.length > 1 && (
          <LineChart
            points={rows.map((measurement) => ({
              date: measurement.date,
              value: measurement.value,
            }))}
            label={chartLabel}
            formatValue={(value) => displayValue(value).toLocaleString(locale)}
          />
        )}
      </section>

      {saveError && (
        <div className="form-feedback form-feedback--error" role="alert">
          {t('body.saveError')}
        </div>
      )}

      {adding ? (
        <form className="measurement-form card card-pad" onSubmit={add}>
          <label className="field">
            <span className="field-label">
              {t('body.valueLabel', { metric: metricName, unit })}
            </span>
            <input
              name={`body-${metric}`}
              type="number"
              inputMode="decimal"
              step={0.1}
              min={0}
              autoComplete="off"
              value={valueDraft}
              onChange={(event) => setValueDraft(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">{t('body.dateLabel')}</span>
            <input
              name="measurement-date"
              type="date"
              autoComplete="off"
              value={dateDraft}
              onChange={(event) => event.target.value && setDateDraft(event.target.value)}
            />
          </label>
          <div className="measurement-form__actions">
            <button
              className="btn btn-accent"
              type="submit"
              disabled={saving || !valueDraft || Number(valueDraft) <= 0}
            >
              {t('train.save')}
            </button>
            <button className="btn btn-ghost" type="button" disabled={saving} onClick={closeForm}>
              {t('workout.cancel')}
            </button>
          </div>
        </form>
      ) : (
        <button
          className="btn btn-ghost btn-block"
          onClick={() => {
            setValueDraft('');
            setSaveError(false);
            setDateDraft(todayISO());
            setAdding(true);
          }}
        >
          {t('body.add')}
        </button>
      )}

      {rows.length > 0 && (
        <section className="measurement-history" aria-labelledby="measurement-history-title">
          <h2 id="measurement-history-title" className="visually-hidden">
            {t('body.history')}
          </h2>
          <ul>
            {rows
              .slice()
              .reverse()
              .slice(0, 10)
              .map((measurement) => {
                const date = fmtDate(measurement.date, i18n.language, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });
                return (
                  <li key={measurement.id}>
                    <span className="mono small muted">{date}</span>
                    <span className="mono">{formatValue(measurement.value)}</span>
                    <button
                      className="iconbtn muted"
                      aria-label={t('body.delete', { metric: metricName, date })}
                      onClick={() =>
                        setPendingRemoval({
                          id: measurement.id,
                          date,
                          metric: metricName,
                          value: formatValue(measurement.value),
                        })
                      }
                    >
                      <IconX />
                    </button>
                  </li>
                );
              })}
          </ul>
        </section>
      )}

      {pendingRemoval && (
        <BottomSheet
          open
          title={t('body.deleteTitle', { metric: pendingRemoval.metric })}
          initialFocusRef={cancelDeleteRef}
          onClose={closeDelete}
        >
          <span className="muted small">
            {t('body.deleteBody', {
              date: pendingRemoval.date,
              value: pendingRemoval.value,
            })}
          </span>
          <button className="btn btn-danger btn-block" disabled={deleting} onClick={confirmDelete}>
            {t('history.deleteConfirm')}
          </button>
          <button
            ref={cancelDeleteRef}
            className="btn btn-ghost btn-block"
            disabled={deleting}
            onClick={closeDelete}
          >
            {t('workout.cancel')}
          </button>
        </BottomSheet>
      )}
    </div>
  );
}
