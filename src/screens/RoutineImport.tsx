import { RoutinePrescription } from '../components/RoutinePrescription';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconBack } from '../components/Icons';
import { PageHeader } from '../components/PageHeader';
import { useCatalog } from '../hooks/useCatalog';
import { exerciseName, searchExercises } from '../lib/exercises';
import {
  buildRoutinePlanKit,
  parseRoutinePlan,
  RoutinePlanError,
  type RoutinePlan,
} from '../lib/routinePlan';
import { isAccountActionCurrent, toast, useStore } from '../state/useStore';

export function RoutineImport() {
  const { t, i18n } = useTranslation();
  useCatalog();
  const { ensureCatalog, importRoutinePlan, nav } = useStore();
  const [source, setSource] = useState('');
  const [preview, setPreview] = useState<RoutinePlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unknown, setUnknown] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const sourceHeading = useRef<HTMLHeadingElement>(null);
  const wasReviewed = useRef(false);
  useEffect(() => {
    if (preview) {
      wasReviewed.current = true;
      previewHeading.current?.focus();
      window.scrollTo(0, 0);
    } else if (wasReviewed.current) {
      sourceHeading.current?.focus();
      window.scrollTo(0, 0);
    }
  }, [preview]);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const fileRequest = useRef(0);
  const results = unknown ? searchExercises(query, null, i18n.language).slice(0, 8) : [];

  async function review(text = source): Promise<void> {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    setUnknown(null);
    setPreview(null);
    try {
      await ensureCatalog();
      setPreview(parseRoutinePlan(text));
    } catch (cause) {
      if (cause instanceof RoutinePlanError) {
        if (cause.code === 'unknown_exercise') {
          setUnknown(cause.exerciseId ?? '');
          setQuery((cause.exerciseId ?? '').replaceAll('_', ' '));
          setError(t('plan.unknownExercise', { exercise: cause.exerciseId }));
        } else setError(t('plan.invalid', { field: cause.path }));
      } else setError(t('plan.readError'));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function readFile(file: File): Promise<void> {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    const request = ++fileRequest.current;
    setPreview(null);
    setError(null);
    setUnknown(null);
    try {
      if (file.size > 2_000_000) throw new Error('file too large');
      const text = await file.text();
      if (request !== fileRequest.current) return;
      setSource(text);
      pending.current = false;
      await review(text);
    } catch {
      if (request === fileRequest.current) setError(t('plan.readError'));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function downloadKit(): Promise<void> {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await ensureCatalog();
      const url = URL.createObjectURL(
        new Blob([buildRoutinePlanKit()], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = 'overload-ai-kit.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError(t('plan.readError'));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function resolveExercise(id: string): void {
    const unwrapped = source
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '');
    try {
      const data = JSON.parse(unwrapped);
      for (const routine of data.routines)
        for (const exercise of routine.exercises) {
          if (exercise.exerciseId === unknown) exercise.exerciseId = id;
        }
      const next = JSON.stringify(data, null, 2);
      setSource(next);
      void review(next);
    } catch {
      setError(t('plan.readError'));
    }
  }

  async function confirm(): Promise<void> {
    if (!preview || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    const actionRoute = useStore.getState().route;
    try {
      const result = await importRoutinePlan(preview);
      if (
        !mounted.current ||
        useStore.getState().route !== actionRoute ||
        !isAccountActionCurrent(result)
      )
        return;
      toast(t(result.value.alreadyImported ? 'plan.alreadyImported' : 'plan.imported'));
      nav({ view: 'train' });
    } catch {
      setError(t('plan.saveError'));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="screen routine-import">
      <PageHeader
        className="detail-page-header"
        title={t('plan.title')}
        back={{ label: t('common.back'), icon: <IconBack />, onClick: () => history.back() }}
      />
      {!preview && (
        <>
          <section className="card card-pad stack">
            <h2 ref={sourceHeading} tabIndex={-1} className="progress-section-title">
              {t('plan.prepare')}
            </h2>
            <p className="small muted">{t('plan.instructions')}</p>
            <button
              className="btn btn-ghost btn-block"
              disabled={busy}
              onClick={() => void downloadKit()}
            >
              {t('plan.download')}
            </button>
          </section>
          <section className="stack" style={{ marginTop: 20 }}>
            <label className="field">
              <span>{t('plan.file')}</span>
              <input
                type="file"
                accept=".json,.txt,application/json,text/plain"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void readFile(file);
                  event.target.value = '';
                }}
              />
            </label>
            <label className="field">
              <span>{t('plan.paste')}</span>
              <textarea
                rows={5}
                style={{ fieldSizing: 'fixed', height: 160, maxHeight: 240, overflowY: 'auto' }}
                value={source}
                disabled={busy}
                spellCheck={false}
                onChange={(event) => {
                  ++fileRequest.current;
                  setSource(event.target.value);
                  setPreview(null);
                  setError(null);
                  setUnknown(null);
                }}
              />
            </label>
            <button
              className="btn btn-accent btn-block"
              disabled={busy || !source.trim()}
              onClick={() => void review()}
            >
              {t(busy ? 'plan.working' : 'plan.review')}
            </button>
          </section>
        </>
      )}
      {error && (
        <p
          className="form-feedback form-feedback--error"
          role="alert"
          style={{ overflowWrap: 'anywhere' }}
        >
          {error}
        </p>
      )}
      {unknown && (
        <section className="stack card card-pad" style={{ marginTop: 16 }}>
          <label className="field">
            <span>{t('plan.chooseExercise')}</span>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          {results.map((exercise) => (
            <button
              className="btn btn-ghost btn-block"
              key={exercise.id}
              disabled={busy}
              onClick={() => resolveExercise(exercise.id)}
            >
              {exerciseName(exercise.id, i18n.language)}
            </button>
          ))}
          {!results.length && <p className="muted">{t('library.noResults')}</p>}
        </section>
      )}
      {preview && (
        <section className="plan-preview stack" style={{ marginTop: 24, overflowWrap: 'anywhere' }}>
          <h2 ref={previewHeading} tabIndex={-1} className="progress-section-title">
            {preview.name}
          </h2>
          {preview.routines.map((routine, index) => (
            <div key={index}>
              <h3>{routine.name}</h3>
              <RoutinePrescription routine={routine} />
            </div>
          ))}
          <button
            className="btn btn-ghost btn-block"
            disabled={busy}
            onClick={() => {
              setPreview(null);
              setError(null);
            }}
          >
            {t('plan.change')}
          </button>
          <p className="small muted">{t('plan.additive')}</p>
          <button
            className="btn btn-accent btn-block btn-big"
            disabled={busy}
            onClick={() => void confirm()}
          >
            {t(busy ? 'plan.working' : 'plan.confirm')}
          </button>
        </section>
      )}
    </div>
  );
}
