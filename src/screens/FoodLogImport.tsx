import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/PageHeader';
import { IconBack } from '../components/Icons';
import { FoodNutrients, foodName } from '../components/FoodNutrients';
import { loadFoodCatalog } from '../lib/foodCatalog';
import {
  parseFoodImport,
  buildFoodImportExample,
  FOOD_IMPORT_GUIDE,
  FoodImportError,
} from '../lib/foodImport';
import { summarizeEntries, type Food } from '../lib/foodDiary';
import { fmtDate } from '../lib/format';
import { isAccountActionCurrent, toast, useStore } from '../state/useStore';
export function FoodLogImport() {
  const { t, i18n } = useTranslation();
  const importDiaryDays = useStore((state) => state.importDiaryDays);
  const [source, setSource] = useState('');
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof parseFoodImport>> | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [error, setError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  function download(text: string, name: string, type = 'text/plain') {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function review(file?: File) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    setPreview(null);
    const actionRoute = useStore.getState().route;
    try {
      if (file && file.size > 2_000_000) throw new Error('large');
      const text = file ? await file.text() : source;
      if (file) setSource(text);
      let foods: Food[];
      try {
        foods = await loadFoodCatalog();
      } catch {
        foods = [];
      }
      const result = await parseFoodImport(text, foods);
      if (!mounted.current || useStore.getState().route !== actionRoute) return;
      setPreview(result);
      requestAnimationFrame(() => {
        if (!mounted.current || useStore.getState().route !== actionRoute) return;
        heading.current?.focus();
        window.scrollTo(0, 0);
      });
    } catch (cause) {
      setError(
        cause instanceof FoodImportError
          ? t(cause.code === 'unknown_food' ? 'food.importUnknown' : 'food.importInvalid', {
              field: cause.path,
              food: cause.foodId,
            })
          : t('food.importReadError'),
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function confirm() {
    if (!preview || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    const actionRoute = useStore.getState().route;
    try {
      const result = await importDiaryDays(preview.days);
      if (
        mounted.current &&
        useStore.getState().route === actionRoute &&
        isAccountActionCurrent(result)
      ) {
        toast(t('food.imported'));
        history.back();
      }
    } catch {
      setError(t('food.saveError'));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="screen food-import">
      <PageHeader
        className="detail-page-header"
        title={t('food.import')}
        back={{ label: t('common.back'), icon: <IconBack />, onClick: () => history.back() }}
      />
      {preview ? (
        <>
          <h2 ref={heading} tabIndex={-1}>
            {t('food.importPreview', { count: preview.count })}
          </h2>
          <p className="small muted">{t('food.importAdditive')}</p>
          {preview.days.map((day) => (
            <section className="food-meal" key={day.date}>
              <h3>{fmtDate(day.date, i18n.language)}</h3>
              <ul className="food-entries">
                {day.entries.map((entry) => (
                  <li key={entry.id}>
                    <div className="food-result">
                      <span>
                        <strong>{foodName(entry.food, i18n.language)}</strong>
                        <small>
                          {t('food.meals.' + entry.meal)} · {entry.quantity} {entry.food.basis} ·{' '}
                          {t('food.source.' + entry.food.source)}
                        </small>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <FoodNutrients
                totals={summarizeEntries(day.entries).totals}
                incomplete={summarizeEntries(day.entries).incomplete}
                compact
              />
              <details>
                <summary>{t('food.allNutrients')}</summary>
                <FoodNutrients
                  totals={summarizeEntries(day.entries).totals}
                  incomplete={summarizeEntries(day.entries).incomplete}
                />
              </details>
            </section>
          ))}
          <button
            className="btn btn-ghost"
            disabled={busy}
            onClick={() => {
              setPreview(null);
              setError('');
            }}
          >
            {t('food.changeFile')}
          </button>
          {error && <p role="alert">{error}</p>}
          <button className="btn btn-accent" disabled={busy} onClick={() => void confirm()}>
            {busy ? t('food.working') : t('food.confirmImport')}
          </button>
        </>
      ) : (
        <>
          <p>{t('food.importHint')}</p>
          <div className="food-tools">
            <button
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => download(FOOD_IMPORT_GUIDE, 'overload-food-format.txt')}
            >
              {t('food.downloadFormat')}
            </button>
            <button
              className="btn btn-ghost"
              disabled={busy}
              onClick={() =>
                download(buildFoodImportExample(), 'overload-food-example.json', 'application/json')
              }
            >
              {t('food.downloadExample')}
            </button>
          </div>
          <label className="field">
            <span>{t('food.openFile')}</span>
            <input
              type="file"
              accept=".json,.csv,.txt,application/json,text/csv,text/plain"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void review(file);
                event.target.value = '';
              }}
            />
          </label>
          <label className="field">
            <span>{t('food.paste')}</span>
            <textarea
              value={source}
              disabled={busy}
              onChange={(event) => {
                setSource(event.target.value);
                setError('');
              }}
            />
          </label>
          {error && (
            <p role="alert" className="form-feedback form-feedback--error">
              {error}
            </p>
          )}
          <button
            className="btn btn-accent"
            disabled={busy || !source.trim()}
            onClick={() => void review()}
          >
            {busy ? t('food.working') : t('food.reviewImport')}
          </button>
        </>
      )}
    </div>
  );
}
