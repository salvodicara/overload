import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconBack } from '../components/Icons';
import { PageHeader } from '../components/PageHeader';
import { BottomSheet } from '../components/BottomSheet';
import { FoodNutrients, foodName } from '../components/FoodNutrients';
import { FoodBarcode } from '../components/FoodBarcode';
import { lookupBarcode, searchFoodCatalog } from '../lib/foodCatalog';
import {
  NUTRIENT_META,
  scaleFood,
  summarizeEntries,
  type Food,
  type FoodEntry,
  type NutrientKey,
  type SavedMeal,
} from '../lib/foodDiary';
import { isAccountActionCurrent, useStore } from '../state/useStore';
import { MEALS } from './FoodDiary';

export function FoodEntryEditor({
  date,
  meal = 'snack',
  entryId,
}: {
  date: string;
  meal?: FoodEntry['meal'];
  entryId?: string;
}) {
  const { t, i18n } = useTranslation();
  const { nutrition, settings, addDiaryEntries, updateDiaryEntry, deleteDiaryEntry } = useStore();
  const existing = nutrition
    .find((day) => day.date === date)
    ?.entries?.find((entry) => entry.id === entryId);
  const [picked, setPicked] = useState<Food | null>(existing?.food ?? null);
  const [quantity, setQuantity] = useState(String(existing?.quantity ?? 100));
  const [group, setGroup] = useState<FoodEntry['meal']>(existing?.meal ?? meal);
  const [tab, setTab] = useState<'search' | 'recent' | 'saved'>('search');
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(20);
  useEffect(() => setVisibleCount(20), [query, tab]);
  const [results, setResults] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState('');
  const [barcode, setBarcode] = useState('');
  const [camera, setCamera] = useState(false);
  const [creating, setCreating] = useState(false);
  const [customName, setCustomName] = useState('');
  const [basis, setBasis] = useState<'g' | 'ml'>('g');
  const [values, setValues] = useState<Partial<Record<NutrientKey, string>>>({});
  const [saved, setSaved] = useState<SavedMeal | null>(null);
  const [portions, setPortions] = useState('1');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removeSaved, setRemoveSaved] = useState<{ meal: SavedMeal; uid: string } | null>(null);
  const [removeSavedError, setRemoveSavedError] = useState('');
  const cancelSavedRemoval = useRef<HTMLButtonElement>(null);
  const savedTab = useRef<HTMLButtonElement>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const barcodeRequest = useRef<AbortController | null>(null);
  useEffect(() => () => barcodeRequest.current?.abort(), []);
  useEffect(() => {
    if (tab !== 'search' || picked || creating || saved) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    const timer = setTimeout(() => {
      void searchFoodCatalog(query, i18n.language)
        .then((foods) => {
          if (!cancelled) setResults(foods);
        })
        .catch(() => {
          if (!cancelled) setError(t('food.catalogError'));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, tab, picked, creating, saved, i18n.language, t]);
  const recent = useMemo(() => {
    const found = new Map<string, Food>();
    for (const day of [...nutrition].sort((a, b) => b.date.localeCompare(a.date)))
      for (const entry of [...(day.entries ?? [])].reverse())
        if (entry.food.source !== 'manual' && !found.has(entry.food.id))
          found.set(entry.food.id, entry.food);
    return [...found.values()].slice(0, 60);
  }, [nutrition]);
  function choose(food: Food) {
    setPicked(food);
    setQuantity('100');
    setError('');
    window.scrollTo(0, 0);
  }
  async function barcodeLookup(code = barcode) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    setCamera(false);
    barcodeRequest.current?.abort();
    const controller = new AbortController();
    barcodeRequest.current = controller;
    try {
      const food = await lookupBarcode(code.trim(), controller.signal);
      if (controller.signal.aborted || !mounted.current) return;
      if (food) choose(food);
      else setError(t('food.barcodeMissing'));
    } catch {
      if (!controller.signal.aborted) setError(t('food.barcodeError'));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function save() {
    if (pending.current) return;
    const amount = Number(quantity);
    const multiplier = Number(portions);
    if (
      (picked && (!Number.isFinite(amount) || amount <= 0 || amount > 100000)) ||
      (saved &&
        (!Number.isFinite(multiplier) ||
          multiplier <= 0 ||
          saved.entries.some((entry) => entry.quantity * multiplier > 100000)))
    ) {
      setError(t('food.quantityError'));
      return;
    }
    pending.current = true;
    setBusy(true);
    setError('');
    const actionRoute = useStore.getState().route;
    try {
      let result;
      if (saved) {
        result = await addDiaryEntries(
          date,
          saved.entries.map((entry) => ({
            ...structuredClone(entry),
            id: crypto.randomUUID(),
            quantity: entry.quantity * multiplier,
            meal: group,
          })),
        );
      } else if (picked) {
        const entry = {
          id: entryId ?? crypto.randomUUID(),
          food: picked,
          quantity: amount,
          meal: group,
        };
        result = entryId
          ? await updateDiaryEntry(date, entry)
          : await addDiaryEntries(date, [entry]);
      }
      if (
        result &&
        mounted.current &&
        useStore.getState().route === actionRoute &&
        isAccountActionCurrent(result)
      )
        history.back();
    } catch {
      setError(t('food.saveError'));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function remove() {
    if (!entryId || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    const actionRoute = useStore.getState().route;
    try {
      const result = await deleteDiaryEntry(date, entryId);
      if (
        mounted.current &&
        useStore.getState().route === actionRoute &&
        isAccountActionCurrent(result)
      )
        history.back();
    } catch {
      setError(t('food.saveError'));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function removeSavedMeal() {
    if (!removeSaved || pending.current) return;
    const state = useStore.getState();
    if (state.user?.uid !== removeSaved.uid) return;
    const actionRoute = state.route;
    const uid = removeSaved.uid;
    pending.current = true;
    setBusy(true);
    setRemoveSavedError('');
    try {
      const result = await state.updateSettings({
        savedMeals: (state.settings.savedMeals ?? []).filter(
          (item) => item.id !== removeSaved.meal.id,
        ),
      });
      if (
        mounted.current &&
        useStore.getState().route === actionRoute &&
        isAccountActionCurrent(result)
      )
        setRemoveSaved(null);
    } catch {
      if (
        mounted.current &&
        useStore.getState().route === actionRoute &&
        useStore.getState().user?.uid === uid
      )
        setRemoveSavedError(t('food.removeSavedMealError'));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function create() {
    const nutrients: Food['nutrients'] = {};
    for (const key of Object.keys(values) as NutrientKey[]) {
      if (values[key]?.trim()) {
        const n = Number(values[key]);
        if (!Number.isFinite(n) || n < 0 || n > 1e9) {
          setError(t('diet.invalid'));
          return;
        }
        nutrients[key] = n;
      }
    }
    if (!customName.trim() || Object.keys(nutrients).length === 0) {
      setError(t('food.customError'));
      return;
    }
    setCreating(false);
    choose({
      id: 'custom:' + crypto.randomUUID(),
      name: customName.trim(),
      basis,
      nutrients,
      source: 'custom',
    });
  }
  const list = tab === 'recent' ? recent : results;
  const currentTotals =
    picked &&
    Number(quantity) > 0 &&
    Number(quantity) <= 100000 &&
    Number.isFinite(Number(quantity))
      ? scaleFood(picked, Number(quantity))
      : {};
  const validPortions =
    Number.isFinite(Number(portions)) &&
    Number(portions) > 0 &&
    saved?.entries.every((entry) => entry.quantity * Number(portions) <= 100000);
  const savedSummary = saved
    ? summarizeEntries(
        saved.entries.map((entry) => ({
          ...entry,
          quantity: entry.quantity * (validPortions ? Number(portions) : 1),
        })),
      )
    : null;
  return (
    <div className="screen food-editor">
      <PageHeader
        className="detail-page-header"
        title={t(entryId ? 'food.editFood' : 'food.addFood')}
        back={{ label: t('common.back'), icon: <IconBack />, onClick: () => history.back() }}
      />
      {entryId && !existing ? (
        <p role="alert">{t('food.entryMissing')}</p>
      ) : picked || saved ? (
        <div className="food-selected">
          <h2>{picked ? foodName(picked, i18n.language) : saved!.name}</h2>
          {picked && (
            <p className="food-source">
              {t('food.source.' + picked.source)}
              {picked.brand ? ' · ' + picked.brand : ''}
            </p>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <label className="field">
              <span>{t('food.meal')}</span>
              <select
                value={group}
                onChange={(event) => setGroup(event.target.value as FoodEntry['meal'])}
              >
                {MEALS.map((item) => (
                  <option key={item} value={item}>
                    {t('food.meals.' + item)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>
                {picked ? t('food.quantity', { unit: picked.basis }) : t('food.portions')}
              </span>
              <input
                type="number"
                inputMode="decimal"
                min="0.001"
                max={
                  picked
                    ? 100000
                    : Math.min(...saved!.entries.map((entry) => 100000 / entry.quantity))
                }
                step="any"
                required
                value={picked ? quantity : portions}
                onChange={(event) =>
                  picked ? setQuantity(event.target.value) : setPortions(event.target.value)
                }
              />
            </label>
            {saved && (
              <ul>
                {saved.entries.map((entry) => (
                  <li key={entry.id}>
                    {foodName(entry.food, i18n.language)} · {entry.quantity} {entry.food.basis}
                  </li>
                ))}
              </ul>
            )}
            <FoodNutrients totals={picked ? currentTotals : savedSummary!.totals} compact />
            <details>
              <summary>{t('food.allNutrients')}</summary>
              <FoodNutrients
                totals={picked ? currentTotals : savedSummary!.totals}
                incomplete={picked ? [] : savedSummary!.incomplete}
              />
            </details>
            {error && (
              <p role="alert" className="form-feedback form-feedback--error">
                {error}
              </p>
            )}
            <button className="btn btn-accent food-save" disabled={busy}>
              {busy ? t('food.working') : t(entryId ? 'common.save' : 'food.addToDiary')}
            </button>
          </form>
          {!entryId && (
            <button
              className="btn btn-ghost btn-block"
              disabled={busy}
              onClick={() => {
                setPicked(null);
                setSaved(null);
                setError('');
              }}
            >
              {t('food.chooseAnother')}
            </button>
          )}
          {entryId && (
            <button
              className="btn btn-ghost btn-block"
              disabled={busy}
              onClick={() => setConfirmDelete(true)}
            >
              {t('food.deleteFood')}
            </button>
          )}
        </div>
      ) : creating ? (
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            create();
          }}
        >
          <h2>{t('food.createFood')}</h2>
          <p className="small muted">{t('food.customHint')}</p>
          <label className="field">
            <span>{t('food.foodName')}</span>
            <input
              value={customName}
              required
              maxLength={200}
              onChange={(event) => setCustomName(event.target.value)}
            />
          </label>
          <label className="field">
            <span>{t('food.per')}</span>
            <select value={basis} onChange={(event) => setBasis(event.target.value as 'g' | 'ml')}>
              <option value="g">100 g</option>
              <option value="ml">100 ml</option>
            </select>
          </label>
          <div className="food-form-grid">
            {(Object.keys(NUTRIENT_META) as NutrientKey[]).slice(0, 8).map((key) => (
              <label className="field" key={key}>
                <span>
                  {t('food.nutrients.' + key)} ({NUTRIENT_META[key].unit})
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={values[key] ?? ''}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [key]: event.target.value }))
                  }
                />
              </label>
            ))}
          </div>
          <details>
            <summary>{t('food.allNutrients')}</summary>
            <div className="food-form-grid">
              {(Object.keys(NUTRIENT_META) as NutrientKey[]).slice(8).map((key) => (
                <label className="field" key={key}>
                  <span>
                    {t('food.nutrients.' + key)} ({NUTRIENT_META[key].unit})
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={values[key] ?? ''}
                    onChange={(event) =>
                      setValues((current) => ({ ...current, [key]: event.target.value }))
                    }
                  />
                </label>
              ))}
            </div>
          </details>
          {error && <p role="alert">{error}</p>}
          <button className="btn btn-accent">{t('food.continue')}</button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setCreating(false);
              setError('');
            }}
          >
            {t('common.cancel')}
          </button>
        </form>
      ) : (
        <fieldset disabled={busy} className="food-picker">
          <div className="food-search-tabs" aria-label={t('food.findFood')}>
            {(['search', 'recent', 'saved'] as const).map((item) => (
              <button
                key={item}
                ref={item === 'saved' ? savedTab : undefined}
                aria-pressed={tab === item}
                onClick={() => {
                  setTab(item);
                  setError('');
                }}
              >
                {t('food.tabs.' + item)}
              </button>
            ))}
          </div>
          {tab === 'search' && (
            <>
              <label className="field">
                <span>{t('food.search')}</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('food.searchHint')}
                />
              </label>
              <details>
                <summary>{t('food.barcode')}</summary>
                <form
                  className="food-search-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void barcodeLookup();
                  }}
                >
                  <label className="field">
                    <span>{t('food.barcodeNumber')}</span>
                    <input
                      inputMode="numeric"
                      pattern="[0-9]{8,14}"
                      required
                      value={barcode}
                      onChange={(event) => setBarcode(event.target.value)}
                    />
                  </label>
                  <button className="btn btn-ghost" disabled={busy}>
                    {t('food.find')}
                  </button>
                </form>
                <button
                  className="btn btn-ghost btn-block"
                  disabled={busy}
                  onClick={() => setCamera(true)}
                >
                  {t('food.scan')}
                </button>
              </details>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setCreating(true);
                  setError('');
                }}
              >
                {t('food.createFood')}
              </button>
            </>
          )}
          {error && (
            <p role="alert" className="food-status">
              {error}
            </p>
          )}
          {busy && <p role="status">{t('food.working')}</p>}
          {tab === 'saved' ? (
            <>
              {!settings.savedMeals?.length && <p className="food-empty">{t('food.noSaved')}</p>}
              {settings.savedMeals?.map((item) => (
                <div key={item.id} className="stack" style={{ gap: 4 }}>
                  <button
                    className="food-result"
                    onClick={() => {
                      setSaved(item);
                      setPortions('1');
                    }}
                  >
                    <span>
                      <strong>{item.name}</strong>
                      <small>{t('food.items', { count: item.entries.length })}</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{
                      alignSelf: 'flex-start',
                      maxWidth: '100%',
                      whiteSpace: 'normal',
                      overflowWrap: 'anywhere',
                    }}
                    aria-label={t('food.removeSavedMeal', { name: item.name })}
                    onClick={() => {
                      const uid = useStore.getState().user?.uid;
                      if (!uid || pending.current) return;
                      setRemoveSavedError('');
                      setRemoveSaved({ meal: item, uid });
                    }}
                  >
                    {t('common.delete')}
                  </button>
                </div>
              ))}
            </>
          ) : (
            <>
              {loading && tab === 'search' ? (
                <p role="status">{t('food.loading')}</p>
              ) : (
                <>
                  {!list.length && (
                    <p className="food-empty">
                      {t(tab === 'recent' ? 'food.noRecent' : 'food.noResults')}
                    </p>
                  )}
                  <ul className="food-results">
                    {list.slice(0, visibleCount).map((food) => (
                      <li key={food.id}>
                        <button className="food-result" onClick={() => choose(food)}>
                          <span>
                            <strong>{foodName(food, i18n.language)}</strong>
                            <small>
                              {food.brand ?? t('food.source.' + food.source)} · {t('food.per')} 100{' '}
                              {food.basis}
                            </small>
                          </span>
                          <span className="mono small">
                            {food.nutrients.kcal === undefined
                              ? '—'
                              : Math.round(food.nutrients.kcal)}{' '}
                            kcal
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {visibleCount < list.length && (
                    <button
                      className="btn btn-ghost"
                      onClick={() => setVisibleCount((count) => count + 20)}
                    >
                      {t('food.showMore')}
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </fieldset>
      )}
      <BottomSheet
        open={removeSaved !== null}
        title={t('food.removeSavedMeal', { name: removeSaved?.meal.name ?? '' })}
        initialFocusRef={cancelSavedRemoval}
        fallbackFocusRef={savedTab}
        onClose={() => {
          if (!busy) setRemoveSaved(null);
        }}
      >
        <p>{t('food.removeSavedMealHint')}</p>
        {removeSavedError && <p role="alert">{removeSavedError}</p>}
        <div className="food-tools">
          <button
            ref={cancelSavedRemoval}
            className="btn btn-ghost"
            disabled={busy}
            onClick={() => setRemoveSaved(null)}
          >
            {t('common.cancel')}
          </button>
          <button className="btn btn-danger" disabled={busy} onClick={() => void removeSavedMeal()}>
            {busy ? t('food.working') : t('common.delete')}
          </button>
        </div>
      </BottomSheet>
      <BottomSheet open={camera} title={t('food.scan')} onClose={() => setCamera(false)}>
        {camera && (
          <FoodBarcode
            onResult={(code) => {
              setBarcode(code);
              void barcodeLookup(code);
            }}
            onClose={() => setCamera(false)}
          />
        )}
      </BottomSheet>
      <BottomSheet
        open={confirmDelete}
        title={t('food.deleteFood')}
        onClose={() => {
          if (!busy) setConfirmDelete(false);
        }}
      >
        <p>{t('food.deleteHint')}</p>
        {error && <p role="alert">{error}</p>}
        <div className="food-tools">
          <button className="btn btn-ghost" disabled={busy} onClick={() => setConfirmDelete(false)}>
            {t('common.cancel')}
          </button>
          <button className="btn btn-danger" disabled={busy} onClick={() => void remove()}>
            {t('common.delete')}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
