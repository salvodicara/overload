import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '../components/BottomSheet';
import { ExerciseMedia } from '../components/ExerciseMedia';
import { IconBack } from '../components/Icons';
import { PageHeader } from '../components/PageHeader';
import { useSurfaceState } from '../hooks/useSurfaceState';
import {
  equipmentLabelKey,
  getCatalog,
  muscleGroup,
  searchExercises,
  type MuscleGroup,
} from '../lib/exercises';
import { newestWorkoutFirst } from '../lib/workoutHistory';
import type { TrackingType } from '../lib/types';
import {
  isAccountActionCurrent,
  STALE_ACCOUNT_ACTION,
  useStore,
  type AccountActionResult,
  type Store,
} from '../state/useStore';

const GROUPS: MuscleGroup[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'calves'];

/** Long lists stay responsive on phones without a virtualiser. */
const MAX_RESULTS = 60;

export async function createCustomExerciseFlow(
  input: {
    name: string;
    muscleGroup: MuscleGroup;
    tracking?: TrackingType;
    pickFor?: { routineId: string } | { activeWorkout: true; replaceInstanceId?: string };
  },
  actions: Pick<Store, 'createCustomExercise' | 'addExerciseToRoutine' | 'nav'> & {
    addWorkoutExercise?(exerciseId: string): void;
    replaceWorkoutExercise?(instanceId: string, exerciseId: string): void;
    close(): void;
    isUiCurrent(): boolean;
  },
): Promise<AccountActionResult<string>> {
  const created = await actions.createCustomExercise(input.name, input.muscleGroup);
  if (!isAccountActionCurrent(created) || !created.value || !actions.isUiCurrent()) {
    return STALE_ACCOUNT_ACTION;
  }

  const id = created.value;
  if (input.pickFor) {
    if ('activeWorkout' in input.pickFor) {
      if (input.pickFor.replaceInstanceId)
        actions.replaceWorkoutExercise?.(input.pickFor.replaceInstanceId, id);
      else actions.addWorkoutExercise?.(id);
      actions.close();
      return created;
    }
    const added = await actions.addExerciseToRoutine(
      input.pickFor.routineId,
      id,
      input.tracking ?? 'weight_reps',
    );
    if (!isAccountActionCurrent(added) || !actions.isUiCurrent()) return STALE_ACCOUNT_ACTION;
    actions.close();
    actions.nav({ view: 'routineEditor', id: input.pickFor.routineId });
  } else {
    actions.close();
    actions.nav({ view: 'exercise', id });
  }
  return created;
}

export function Library({
  pickFor,
}: {
  pickFor?: { routineId: string } | { activeWorkout: true; replaceInstanceId?: string };
}) {
  const { t, i18n } = useTranslation();
  const ensureCatalog = useStore((state) => state.ensureCatalog);
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const workouts = useStore((s) => s.workouts);
  const catalogReady = useStore((s) => s.catalogReady);
  useEffect(() => {
    if (catalogReady) return;
    let active = true;
    let retry: number | undefined;
    setCatalogFailed(false);
    const ensure = (canRetry: boolean) => {
      void ensureCatalog().catch(() => {
        if (!active) return;
        if (canRetry) retry = window.setTimeout(() => ensure(false), 500);
        else setCatalogFailed(true);
      });
    };
    ensure(true);
    const retryWhenOnline = () => setCatalogAttempt((attempt) => attempt + 1);
    window.addEventListener('online', retryWhenOnline);
    return () => {
      active = false;
      if (retry !== undefined) window.clearTimeout(retry);
      window.removeEventListener('online', retryWhenOnline);
    };
  }, [catalogReady, ensureCatalog, catalogAttempt]);
  const nav = useStore((s) => s.nav);
  const addExerciseToRoutine = useStore((s) => s.addExerciseToRoutine);
  const addWorkoutExercise = useStore((s) => s.addWorkoutExercise);
  const replaceWorkoutExercise = useStore((s) => s.replaceWorkoutExercise);
  const createCustomExercise = useStore((s) => s.createCustomExercise);
  const [surface, setSurface] = useSurfaceState('library', {
    query: '',
    group: null,
    visibleCount: MAX_RESULTS,
    equipment: '',
    sort: pickFor ? 'recent' : 'name',
  });
  const query = surface.query ?? '';
  const equipment = surface.equipment ?? '';
  const sort = surface.sort ?? 'name';
  const equipmentOptions = useMemo(
    () =>
      [
        ...new Set(
          [...getCatalog().values()]
            .map((item) => item.equipment)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort((a, b) => t(equipmentLabelKey(a)).localeCompare(t(equipmentLabelKey(b)))),
    [catalogReady, t],
  );
  const group = GROUPS.includes(surface.group as MuscleGroup)
    ? (surface.group as MuscleGroup)
    : null;
  const visibleCount = surface.visibleCount ?? MAX_RESULTS;
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState<MuscleGroup>('chest');
  const [newTracking, setNewTracking] = useState<TrackingType>('weight_reps');
  const [pendingPick, setPendingPick] = useState<string | null>(null);
  const [createPending, setCreatePending] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const mountedRef = useRef(true);
  const sheetGenerationRef = useRef(0);
  const submitGenerationRef = useRef<number | null>(null);
  const searchId = useId();
  const newNameId = useId();
  const newGroupId = useId();
  const newTrackingId = useId();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      sheetGenerationRef.current += 1;
    };
  }, []);

  const results = useMemo(() => {
    const filtered = searchExercises(query, group, i18n.language).filter(
      (item) => !equipment || item.equipment === equipment,
    );
    if (sort !== 'recent') return filtered;
    const recent = new Map<string, number>();
    for (const workout of [...workouts].sort(newestWorkoutFirst)) {
      for (const set of workout.sets)
        if (set.done && !recent.has(set.exerciseId)) recent.set(set.exerciseId, recent.size);
    }
    return filtered.sort((a, b) => (recent.get(a.id) ?? Infinity) - (recent.get(b.id) ?? Infinity));
  }, [catalogReady, query, group, i18n.language, equipment, sort, workouts]);
  const shown = results.slice(0, visibleCount);
  const hasMore = shown.length < results.length;
  function revealMore(): void {
    setSurface((current) => ({
      ...current,
      visibleCount: Math.min((current.visibleCount ?? MAX_RESULTS) + MAX_RESULTS, results.length),
    }));
  }

  useEffect(() => {
    const target = moreRef.current;
    if (!target || !hasMore || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          revealMore();
        }
      },
      { rootMargin: '240px 0px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, query, group, results.length, shown.length]);

  async function pick(id: string): Promise<void> {
    if (pendingPick) return;
    if (!pickFor) {
      nav({ view: 'exercise', id });
      return;
    }
    if ('activeWorkout' in pickFor) {
      if (pickFor.replaceInstanceId) replaceWorkoutExercise(pickFor.replaceInstanceId, id);
      else addWorkoutExercise(id);
      return;
    }

    setOperationError(null);
    setPendingPick(id);
    try {
      const result = await addExerciseToRoutine(pickFor.routineId, id);
      if (!mountedRef.current || !isAccountActionCurrent(result)) return;
      nav({ view: 'routineEditor', id: pickFor.routineId });
    } catch {
      if (mountedRef.current) setOperationError(t('library.addError'));
    } finally {
      if (mountedRef.current) setPendingPick(null);
    }
  }

  function openCreateSheet(): void {
    sheetGenerationRef.current += 1;
    submitGenerationRef.current = null;
    setNewName(query);
    setNewGroup(group ?? 'chest');
    setNewTracking('weight_reps');
    setOperationError(null);
    setCreatePending(false);
    setCreating(true);
  }

  function dismissCreateSheet(): void {
    sheetGenerationRef.current += 1;
    submitGenerationRef.current = null;
    setOperationError(null);
    setCreatePending(false);
    setCreating(false);
  }

  async function submitCustomExercise(): Promise<void> {
    if (!newName.trim() || submitGenerationRef.current !== null) return;
    const generation = sheetGenerationRef.current;
    submitGenerationRef.current = generation;
    setOperationError(null);
    setCreatePending(true);

    const isUiCurrent = () =>
      mountedRef.current &&
      sheetGenerationRef.current === generation &&
      submitGenerationRef.current === generation;

    try {
      await createCustomExerciseFlow(
        {
          name: newName.trim(),
          muscleGroup: newGroup,
          tracking: newTracking,
          pickFor,
        },
        {
          createCustomExercise,
          addExerciseToRoutine,
          addWorkoutExercise,
          replaceWorkoutExercise,
          nav,
          isUiCurrent,
          close: () => {
            if (isUiCurrent()) setCreating(false);
          },
        },
      );
    } catch {
      if (isUiCurrent()) setOperationError(t('library.createError'));
    } finally {
      if (submitGenerationRef.current === generation) submitGenerationRef.current = null;
      if (mountedRef.current && sheetGenerationRef.current === generation) {
        setCreatePending(false);
      }
    }
  }

  return (
    <div className="screen library-screen">
      <PageHeader
        className="detail-page-header"
        title={t(pickFor ? 'library.pickTitle' : 'library.title')}
        back={{ label: t('common.back'), icon: <IconBack />, onClick: () => history.back() }}
      />

      <div className="library-tools" role="search">
        <label className="field-label" htmlFor={searchId}>
          {t('library.searchLabel')}
        </label>
        <input
          id={searchId}
          type="search"
          value={query}
          placeholder={t('library.search')}
          onChange={(event) =>
            setSurface((current) => ({
              ...current,
              query: event.target.value,
              visibleCount: MAX_RESULTS,
            }))
          }
        />
        <div className="library-filters" role="group" aria-label={t('library.muscleGroup')}>
          <button
            type="button"
            className="library-filter"
            aria-pressed={group === null}
            onClick={() =>
              setSurface((current) => ({ ...current, group: null, visibleCount: MAX_RESULTS }))
            }
          >
            {t('library.all')}
          </button>
          {GROUPS.map((muscle) => (
            <button
              key={muscle}
              type="button"
              className="library-filter"
              aria-pressed={group === muscle}
              onClick={() =>
                setSurface((current) => ({
                  ...current,
                  group: muscle,
                  visibleCount: MAX_RESULTS,
                }))
              }
            >
              {t(`library.muscle.${muscle}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="row" style={{ gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <label className="field" style={{ flex: '1 1 150px', minWidth: 0 }}>
          <span>{t('library.equipmentFilter')}</span>
          <select
            value={equipment}
            onChange={(event) =>
              setSurface((current) => ({
                ...current,
                equipment: event.target.value,
                visibleCount: MAX_RESULTS,
              }))
            }
          >
            <option value="">{t('library.allEquipment')}</option>
            {equipmentOptions.map((item) => (
              <option key={item} value={item}>
                {t(equipmentLabelKey(item))}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ flex: '1 1 150px', minWidth: 0 }}>
          <span>{t('library.sort')}</span>
          <select
            value={sort}
            onChange={(event) =>
              setSurface((current) => ({
                ...current,
                sort: event.target.value as 'name' | 'recent',
                visibleCount: MAX_RESULTS,
              }))
            }
          >
            <option value="name">{t('library.sortName')}</option>
            <option value="recent">{t('library.sortRecent')}</option>
          </select>
        </label>
      </div>
      {operationError && !creating && (
        <div className="form-feedback form-feedback--error" role="alert">
          {operationError}
        </div>
      )}

      {!catalogReady && catalogFailed && (
        <div className="form-feedback form-feedback--error" role="alert">
          <p>{t('library.loadError')}</p>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setCatalogAttempt((attempt) => attempt + 1)}
          >
            {t('library.retry')}
          </button>
        </div>
      )}
      {!catalogReady && catalogFailed && shown.length === 0 ? null : !catalogReady &&
        shown.length === 0 ? (
        <div className="library-loading" role="status" aria-label={t('library.loading')}>
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="library-result library-result--skeleton" aria-hidden="true">
              <span className="library-result__thumb" />
              <span className="library-result__copy" />
            </div>
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="library-empty">
          <p>{t('library.noResults')}</p>
          <p className="muted small">{t('library.noResultsHint')}</p>
        </div>
      ) : (
        <ul className="library-results" aria-label={t('library.results')}>
          {shown.map((exercise) => {
            const name = i18n.language.startsWith('it') ? exercise.nameIt : exercise.nameEn;
            const muscle = t(`library.muscle.${muscleGroup(exercise)}`);
            const equipmentId = `equipment-${exercise.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
            return (
              <li key={exercise.id}>
                <button
                  type="button"
                  className="library-result"
                  aria-label={`${name} ${muscle}`}
                  aria-describedby={exercise.equipment ? equipmentId : undefined}
                  disabled={pendingPick !== null}
                  onClick={() => void pick(exercise.id)}
                >
                  <ExerciseMedia exercise={exercise} size="thumb" />
                  <span className="library-result__body">
                    <span className="library-result__name">{name}</span>
                    <span className="library-result__meta">
                      <span>{muscle}</span>
                      {exercise.equipment && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span id={equipmentId}>{t(equipmentLabelKey(exercise.equipment))}</span>
                        </>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {results.length > 0 && (
        <div className="library-more">
          <span className="mono small muted" role="status">
            {t('library.resultCount', { shown: shown.length, total: results.length })}
          </span>
          {hasMore && (
            <button ref={moreRef} type="button" className="btn btn-ghost" onClick={revealMore}>
              {t('library.showMore')}
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        className="btn btn-ghost btn-block library-create-action"
        onClick={openCreateSheet}
      >
        {t('library.create')}
      </button>

      <BottomSheet
        open={creating}
        title={t('library.create')}
        initialFocusRef={nameInputRef}
        closeOnScrim
        onClose={dismissCreateSheet}
      >
        <div className="form-field">
          <label className="field-label" htmlFor={newNameId}>
            {t('library.exerciseName')}
          </label>
          <input
            ref={nameInputRef}
            id={newNameId}
            value={newName}
            autoComplete="off"
            disabled={createPending}
            onChange={(event) => setNewName(event.target.value)}
          />
        </div>

        <div className="form-field">
          <label className="field-label" htmlFor={newGroupId}>
            {t('library.muscleGroup')}
          </label>
          <select
            id={newGroupId}
            value={newGroup}
            disabled={createPending}
            onChange={(event) => setNewGroup(event.target.value as MuscleGroup)}
          >
            {GROUPS.map((muscle) => (
              <option key={muscle} value={muscle}>
                {t(`library.muscle.${muscle}`)}
              </option>
            ))}
          </select>
        </div>

        {pickFor && (
          <div className="form-field">
            <label className="field-label" htmlFor={newTrackingId}>
              {t('library.trackingForRoutine')}
            </label>
            <select
              id={newTrackingId}
              value={newTracking}
              disabled={createPending}
              onChange={(event) => setNewTracking(event.target.value as TrackingType)}
            >
              <option value="weight_reps">{t('editor.trackingWeightReps')}</option>
              <option value="reps">{t('editor.trackingReps')}</option>
              <option value="duration">{t('editor.trackingDuration')}</option>
            </select>
            <p className="field-hint">{t('library.trackingHint')}</p>
          </div>
        )}

        {operationError && (
          <div className="form-feedback form-feedback--error" role="alert">
            {operationError}
          </div>
        )}

        <button
          type="button"
          className="btn btn-accent btn-block"
          disabled={!newName.trim() || createPending}
          onClick={() => void submitCustomExercise()}
        >
          {createPending ? t('library.creating') : t('train.createConfirm')}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-block"
          disabled={createPending}
          onClick={dismissCreateSheet}
        >
          {t('workout.cancel')}
        </button>
      </BottomSheet>
    </div>
  );
}
